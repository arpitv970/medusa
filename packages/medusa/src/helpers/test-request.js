import { asValue, createContainer } from "awilix"
import express from "express"
import jwt from "jsonwebtoken"
import { MockManager } from "medusa-test-utils"
import "reflect-metadata"
import supertest from "supertest"
import querystring from "querystring"
import apiLoader from "../loaders/api"
import servicesLoader from "../loaders/services"
import strategiesLoader, { authStrategies } from "../loaders/strategies"
import { asArray } from "../loaders"

const adminSessionOpts = {
  cookieName: "session",
  secret: "test",
}
export { adminSessionOpts }
export { clientSessionOpts }

const clientSessionOpts = {
  cookieName: "session",
  secret: "test",
}

const config = {
  projectConfig: {
    jwt_secret: 'supersecret',
    cookie_secret: 'superSecret',
    admin_cors: '',
    store_cors: ''
  }
}

let supertestRequest
const loadSupertest = async () => {
  const testApp = express()

  const container = createContainer()
  container.register('configModule', asValue(config))
  container.register({
    logger: asValue({
      error: () => {},
    }),
    manager: asValue(MockManager),
  })
  container.registerAdd = (name, registration) => {
    const storeKey = name + "_STORE"

    if (container.registrations[storeKey] === undefined) {
      container.register(storeKey, asValue([]))
    }
    const store = container.resolve(storeKey)

    if (container.registrations[name] === undefined) {
      container.register(name, asArray(store))
    }
    store.unshift(registration)

    return container
  }

  testApp.set("trust proxy", 1)
  testApp.use((req, res, next) => {
    req.session = {}
    const data = req.get("Cookie")
    if (data) {
      req.session = {
        ...req.session,
        ...JSON.parse(data),
      }
    }
    next()
  })

  servicesLoader({ container, configModule: config })
  strategiesLoader({ container, configModule: config })
  await authStrategies({
    container,
    configModule: config,
    app: testApp
  })

  testApp.use((req, res, next) => {
    req.scope = container.createScope()
    next()
  })

  await apiLoader({ container, app: testApp, configModule: config })

  return supertest(testApp)
}

export async function request(method, url, opts = {}) {
  const { payload, query, headers = {} } = opts

  if (!supertestRequest) {
    supertestRequest = await loadSupertest()
  }
  const queryParams = query && querystring.stringify(query);
  const req = supertestRequest[method.toLowerCase()](`${url}${queryParams ? "?" + queryParams : ''}`)
  headers.Cookie = headers.Cookie || ""
  if (opts.adminSession) {
    if (opts.adminSession.jwt) {
      opts.adminSession.jwt = jwt.sign(
        opts.adminSession.jwt,
        config.projectConfig.jwt_secret,
        {
          expiresIn: "30m",
        }
      )
    }
    headers.Cookie = JSON.stringify(opts.adminSession) || ""
  }
  if (opts.clientSession) {
    if (opts.clientSession.jwt) {
      opts.clientSession.jwt = jwt.sign(
        opts.clientSession.jwt,
        config.projectConfig.jwt_secret,
        {
          expiresIn: "30d",
        }
      )
    }

    headers.Cookie = JSON.stringify(opts.clientSession) || ""
  }

  for (const name in headers) {
    req.set(name, headers[name])
  }

  if (payload && !req.get("content-type")) {
    req.set("Content-Type", "application/json")
  }

  if (!req.get("accept")) {
    req.set("Accept", "application/json")
  }

  req.set("Host", "localhost")

  let res
  try {
    res = await req.send(JSON.stringify(payload))
  } catch (e) {
    if (e.response) {
      res = e.response
    } else {
      throw e
    }
  }

  // let c =
  //  res.headers["set-cookie"] && cookie.parse(res.headers["set-cookie"][0])
  // res.adminSession =
  //  c &&
  //  c[adminSessionOpts.cookieName] &&
  //  sessions.util.decode(adminSessionOpts, c[adminSessionOpts.cookieName])
  //    .content
  // res.clientSession =
  //  c &&
  //  c[clientSessionOpts.cookieName] &&
  //  sessions.util.decode(clientSessionOpts, c[clientSessionOpts.cookieName])
  //    .content

  return res
}

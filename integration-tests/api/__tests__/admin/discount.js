const path = require("path")
const { Region, DiscountRule, Discount } = require("@medusajs/medusa")

const setupServer = require("../../../helpers/setup-server")
const { useApi } = require("../../../helpers/use-api")
const { initDb, useDb } = require("../../../helpers/use-db")
const adminSeeder = require("../../helpers/admin-seeder")
const discountSeeder = require("../../helpers/discount-seeder")
const { exportAllDeclaration } = require("@babel/types")
const { simpleProductFactory } = require("../../factories")

jest.setTimeout(30000)

describe("/admin/discounts", () => {
  let medusaProcess
  let dbConnection

  beforeAll(async () => {
    const cwd = path.resolve(path.join(__dirname, "..", ".."))
    dbConnection = await initDb({ cwd })
    medusaProcess = await setupServer({ cwd })
  })

  afterAll(async () => {
    const db = useDb()
    await db.shutdown()
    medusaProcess.kill()
  })

  describe("GET /admin/discounts", () => {
    beforeEach(async () => {
      const manager = dbConnection.manager
      await adminSeeder(dbConnection)
      await manager.insert(DiscountRule, {
        id: "test-discount-rule",
        description: "Test discount rule",
        type: "percentage",
        value: 10,
        allocation: "total",
      })
      await manager.insert(DiscountRule, {
        id: "test-discount-rule-fixed",
        description: "Test discount rule",
        type: "fixed",
        value: 10,
        allocation: "total",
      })
      await manager.insert(Discount, {
        id: "test-discount",
        code: "TESTING",
        rule_id: "test-discount-rule",
        is_dynamic: false,
        is_disabled: false,
      })
      await manager.insert(Discount, {
        id: "messi-discount",
        code: "BARCA100",
        rule_id: "test-discount-rule",
        is_dynamic: false,
        is_disabled: false,
      })
      await manager.insert(Discount, {
        id: "dynamic-discount",
        code: "Dyn100",
        rule_id: "test-discount-rule",
        is_dynamic: true,
        is_disabled: false,
      })
      await manager.insert(Discount, {
        id: "disabled-discount",
        code: "Dis100",
        rule_id: "test-discount-rule",
        is_dynamic: false,
        is_disabled: true,
      })
      await manager.insert(Discount, {
        id: "fixed-discount",
        code: "fixed100",
        rule_id: "test-discount-rule-fixed",
        is_dynamic: false,
        is_disabled: false,
      })
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("should list discounts that match a specific query in a case insensitive manner", async () => {
      const api = useApi()

      const response = await api
        .get("/admin/discounts?q=barca", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          console.log(err)
        })
      expect(response.status).toEqual(200)
      expect(response.data.count).toEqual(1)
      expect(response.data.discounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "messi-discount",
            code: "BARCA100",
          }),
        ])
      )
    })

    it("lists fixed discounts", async () => {
      const api = useApi()

      const response = await api
        .get("/admin/discounts?rule[type]=fixed", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          console.log(err)
        })
      expect(response.status).toEqual(200)
      expect(response.data.count).toEqual(1)
      expect(response.data.discounts).toEqual([
        expect.objectContaining({
          id: "fixed-discount",
          code: "fixed100",
        }),
      ])
    })

    it("fails when listing invalid discount types", async () => {
      expect.assertions(3)
      const api = useApi()

      await api
        .get("/admin/discounts?rule[type]=blah", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          expect(err.response.status).toEqual(400)
          expect(err.response.data.type).toEqual("invalid_data")
          expect(err.response.data.message).toEqual(
            "type must be a valid enum value"
          )
        })
    })

    it("lists percentage discounts ", async () => {
      const api = useApi()

      const notExpected = expect.objectContaining({
        rule: expect.objectContaining({ type: "fixed" }),
      })

      const response = await api
        .get("/admin/discounts?rule[type]=percentage", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          console.log(err)
        })
      expect(response.status).toEqual(200)
      expect(response.data.discounts).toEqual(
        expect.not.arrayContaining([notExpected])
      )
    })

    it("lists dynamic discounts ", async () => {
      const api = useApi()

      const response = await api
        .get("/admin/discounts?is_dynamic=true", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          console.log(err)
        })
      expect(response.status).toEqual(200)
      expect(response.data.count).toEqual(1)
      expect(response.data.discounts).toEqual([
        expect.objectContaining({
          id: "dynamic-discount",
          code: "Dyn100",
        }),
      ])
    })

    it("lists disabled discounts ", async () => {
      const api = useApi()

      const response = await api
        .get("/admin/discounts?is_disabled=true", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          console.log(err)
        })
      expect(response.status).toEqual(200)
      expect(response.data.count).toEqual(1)
      expect(response.data.discounts).toEqual([
        expect.objectContaining({
          id: "disabled-discount",
          code: "Dis100",
        }),
      ])
    })
  })

  describe("POST /admin/discounts", () => {
    beforeEach(async () => {
      try {
        await adminSeeder(dbConnection)
        await discountSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("creates a discount with a rule", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 10,
        })
      )
    })

    it("creates a discount with conditions", async () => {
      const api = useApi()

      const product = await simpleProductFactory(dbConnection, {
        type: "pants",
        tags: ["ss22"],
      })

      const anotherProduct = await simpleProductFactory(dbConnection, {
        type: "blouses",
        tags: ["ss23"],
      })

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
              conditions: [
                {
                  resource_type: "products",
                  resource_ids: [product.id],
                  operator: "in",
                },
                {
                  resource_type: "products",
                  resource_ids: [anotherProduct.id],
                  operator: "not_in",
                },
                {
                  resource_type: "product_types",
                  resource_ids: [product.type_id],
                  operator: "not_in",
                },
                {
                  resource_type: "product_types",
                  resource_ids: [anotherProduct.type_id],
                  operator: "in",
                },
                {
                  resource_type: "product_tags",
                  resource_ids: [product.tags[0].id],
                  operator: "not_in",
                },
                {
                  resource_type: "product_tags",
                  resource_ids: [anotherProduct.tags[0].id],
                  operator: "in",
                },
              ],
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount.rule.conditions).toEqual([
        expect.objectContaining({
          type: "products",
          operator: "in",
        }),
        expect.objectContaining({
          type: "products",
          operator: "not_in",
        }),
        expect.objectContaining({
          type: "product_types",
          operator: "not_in",
        }),
        expect.objectContaining({
          type: "product_types",
          operator: "in",
        }),
        expect.objectContaining({
          type: "product_tags",
          operator: "not_in",
        }),
        expect.objectContaining({
          type: "product_tags",
          operator: "in",
        }),
      ])
    })

    it("creates a discount with conditions and updates said conditions", async () => {
      const api = useApi()

      const product = await simpleProductFactory(dbConnection, {
        type: "pants",
      })

      const anotherProduct = await simpleProductFactory(dbConnection, {
        type: "pants",
      })

      const response = await api
        .post(
          "/admin/discounts?expand=rule,rule.conditions",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
              conditions: [
                {
                  resource_type: "products",
                  resource_ids: [product.id],
                  operator: "in",
                },
                {
                  resource_type: "product_types",
                  resource_ids: [product.type_id],
                  operator: "not_in",
                },
              ],
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount.rule.conditions).toEqual([
        expect.objectContaining({
          type: "products",
          operator: "in",
        }),
        expect.objectContaining({
          type: "product_types",
          operator: "not_in",
        }),
      ])

      const createdRule = response.data.discount.rule
      const condsToUpdate = createdRule.conditions[0]

      const updated = await api
        .post(
          `/admin/discounts/${response.data.discount.id}?expand=rule,rule.conditions,rule.conditions.products`,
          {
            rule: {
              id: createdRule.id,
              type: createdRule.type,
              value: createdRule.value,
              allocation: createdRule.allocation,
              conditions: [
                {
                  id: condsToUpdate.id,
                  resource_type: "products",
                  resource_ids: [product.id, anotherProduct.id],
                },
              ],
            },
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(updated.status).toEqual(200)
      expect(updated.data.discount.rule.conditions).toEqual([
        expect.objectContaining({
          type: "products",
          operator: "in",
          products: expect.arrayContaining([
            expect.objectContaining({
              id: product.id,
            }),
            expect.objectContaining({
              id: anotherProduct.id,
            }),
          ]),
        }),
        expect.objectContaining({
          type: "product_types",
          operator: "not_in",
        }),
      ])
    })

    it("fails to add condition on rule with existing comb. of type and operator", async () => {
      const api = useApi()

      const product = await simpleProductFactory(dbConnection, {
        type: "pants",
      })

      const anotherProduct = await simpleProductFactory(dbConnection, {
        type: "pants",
      })

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
              conditions: [
                {
                  resource_type: "products",
                  resource_ids: [product.id],
                  operator: "in",
                },
              ],
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)

      const createdRule = response.data.discount.rule

      try {
        await api.post(
          `/admin/discounts/${response.data.discount.id}?expand=rule,rule.conditions,rule.conditions.products`,
          {
            rule: {
              id: createdRule.id,
              type: createdRule.type,
              value: createdRule.value,
              allocation: createdRule.allocation,
              conditions: [
                {
                  resource_type: "products",
                  resource_ids: [anotherProduct.id],
                  operator: "in",
                },
              ],
            },
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
      } catch (error) {
        console.log(error)
        expect(error.response.data.type).toEqual("duplicate_error")
        expect(error.response.data.message).toEqual(
          `Discount Condition with operator 'in' and type 'products' already exist on a Discount Rule`
        )
      }
    })

    it("creates a discount and updates it", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 10,
        })
      )

      const updated = await api
        .post(
          `/admin/discounts/${response.data.discount.id}`,
          {
            usage_limit: 20,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(updated.status).toEqual(200)
      expect(updated.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 20,
        })
      )
    })

    it("automatically sets the code to an uppercase string on update", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOworld",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 10,
        })
      )

      const updated = await api
        .post(
          `/admin/discounts/${response.data.discount.id}`,
          {
            code: "HELLOWORLD_test",
            usage_limit: 20,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(updated.status).toEqual(200)
      expect(updated.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD_TEST",
          usage_limit: 20,
        })
      )
    })

    it("creates a dynamic discount and updates it", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD_DYNAMIC",
            is_dynamic: true,
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD_DYNAMIC",
          usage_limit: 10,
          is_dynamic: true,
        })
      )

      const updated = await api
        .post(
          `/admin/discounts/${response.data.discount.id}`,
          {
            usage_limit: 20,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(updated.status).toEqual(200)
      expect(updated.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD_DYNAMIC",
          usage_limit: 20,
          is_dynamic: true,
        })
      )
    })

    it("fails to create a fixed discount with multiple regions", async () => {
      expect.assertions(2)
      const api = useApi()

      await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            is_dynamic: true,
            rule: {
              description: "test",
              type: "fixed",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
            regions: ["test-region", "test-region-2"],
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          expect(err.response.status).toEqual(400)
          expect(err.response.data.message).toEqual(
            `Fixed discounts can have one region`
          )
        })
    })

    it("fails to update a fixed discount with multiple regions", async () => {
      expect.assertions(2)
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "fixed",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      await api
        .post(
          `/admin/discounts/${response.data.discount.id}`,
          {
            regions: ["test-region", "test-region-2"],
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )

        .catch((err) => {
          expect(err.response.status).toEqual(400)
          expect(err.response.data.message).toEqual(
            `Fixed discounts can have one region`
          )
        })
    })

    it("fails to add a region to a fixed discount with an existing region", async () => {
      expect.assertions(2)
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "fixed",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
            regions: ["test-region"],
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      await api
        .post(
          `/admin/discounts/${response.data.discount.id}/regions/test-region-2`,
          {},
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )

        .catch((err) => {
          expect(err.response.status).toEqual(400)
          expect(err.response.data.message).toEqual(
            `Fixed discounts can have one region`
          )
        })
    })

    it("creates a discount with start and end dates", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
            starts_at: new Date("09/15/2021 11:50"),
            ends_at: new Date("09/15/2021 17:50"),
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 10,
          starts_at: expect.any(String),
          ends_at: expect.any(String),
        })
      )

      expect(new Date(response.data.discount.starts_at)).toEqual(
        new Date("09/15/2021 11:50")
      )

      expect(new Date(response.data.discount.ends_at)).toEqual(
        new Date("09/15/2021 17:50")
      )

      const updated = await api
        .post(
          `/admin/discounts/${response.data.discount.id}`,
          {
            usage_limit: 20,
            starts_at: new Date("09/14/2021 11:50"),
            ends_at: new Date("09/17/2021 17:50"),
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(updated.status).toEqual(200)
      expect(updated.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 20,
          starts_at: expect.any(String),
          ends_at: expect.any(String),
        })
      )

      expect(new Date(updated.data.discount.starts_at)).toEqual(
        new Date("09/14/2021 11:50")
      )

      expect(new Date(updated.data.discount.ends_at)).toEqual(
        new Date("09/17/2021 17:50")
      )
    })

    it("fails to update end date to a date before start date", async () => {
      expect.assertions(6)

      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
            starts_at: new Date("09/15/2021 11:50"),
            ends_at: new Date("09/15/2021 17:50"),
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          usage_limit: 10,
          starts_at: expect.any(String),
          ends_at: expect.any(String),
        })
      )

      expect(new Date(response.data.discount.starts_at)).toEqual(
        new Date("09/15/2021 11:50")
      )

      expect(new Date(response.data.discount.ends_at)).toEqual(
        new Date("09/15/2021 17:50")
      )

      await api
        .post(
          `/admin/discounts/${response.data.discount.id}`,
          {
            usage_limit: 20,
            ends_at: new Date("09/11/2021 17:50"),
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          expect(err.response.status).toEqual(400)
          expect(err.response.data.message).toEqual(
            `"ends_at" must be greater than "starts_at"`
          )
        })
    })

    it("fails to create discount with end date before start date", async () => {
      expect.assertions(2)
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "HELLOWORLD",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
            starts_at: new Date("09/15/2021 11:50"),
            ends_at: new Date("09/14/2021 17:50"),
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          expect(err.response.status).toEqual(400)
          expect(err.response.data).toEqual(
            expect.objectContaining({
              message: `"ends_at" must be greater than "starts_at"`,
            })
          )
        })
    })
  })

  describe("testing for soft-deletion + uniqueness on discount codes", () => {
    let manager
    beforeEach(async () => {
      manager = dbConnection.manager
      await adminSeeder(dbConnection)
      await manager.insert(DiscountRule, {
        id: "test-discount-rule",
        description: "Test discount rule",
        type: "percentage",
        value: 10,
        allocation: "total",
      })
      await manager.insert(Discount, {
        id: "test-discount",
        code: "TESTING",
        rule_id: "test-discount-rule",
        is_dynamic: false,
        is_disabled: false,
      })
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("successfully creates discount with soft-deleted discount code", async () => {
      const api = useApi()

      // First we soft-delete the discount
      await api
        .delete("/admin/discounts/test-discount", {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          console.log(err)
        })

      // Lets try to create a discount with same code as deleted one
      const response = await api
        .post(
          "/admin/discounts",
          {
            code: "TESTING",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "TESTING",
          usage_limit: 10,
        })
      )
    })

    it("should fails when creating a discount with already existing code", async () => {
      const api = useApi()

      // Lets try to create a discount with same code as deleted one
      try {
        await api.post(
          "/admin/discounts",
          {
            code: "TESTING",
            rule: {
              description: "test",
              type: "percentage",
              value: 10,
              allocation: "total",
            },
            usage_limit: 10,
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
      } catch (error) {
        expect(error.response.data.message).toEqual(
          "Discount with code TESTING already exists."
        )
      }
    })
  })

  describe("POST /admin/discounts/:discount_id/dynamic-codes", () => {
    beforeEach(async () => {
      const manager = dbConnection.manager
      try {
        await adminSeeder(dbConnection)
        await manager.insert(DiscountRule, {
          id: "test-discount-rule",
          description: "Dynamic rule",
          type: "percentage",
          value: 10,
          allocation: "total",
        })
        await manager.insert(Discount, {
          id: "test-discount",
          code: "DYNAMIC",
          is_dynamic: true,
          is_disabled: false,
          rule_id: "test-discount-rule",
          valid_duration: "P2Y",
        })
        await manager.insert(DiscountRule, {
          id: "test-discount-rule1",
          description: "Dynamic rule",
          type: "percentage",
          value: 10,
          allocation: "total",
        })
        await manager.insert(Discount, {
          id: "test-discount1",
          code: "DYNAMICCode",
          is_dynamic: true,
          is_disabled: false,
          rule_id: "test-discount-rule1",
        })
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("creates a dynamic discount with ends_at", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts/test-discount/dynamic-codes",
          {
            code: "HELLOWORLD",
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          ends_at: expect.any(String),
        })
      )
    })

    it("creates a dynamic discount without ends_at", async () => {
      const api = useApi()

      const response = await api
        .post(
          "/admin/discounts/test-discount1/dynamic-codes",
          {
            code: "HELLOWORLD",
          },
          {
            headers: {
              Authorization: "Bearer test_token",
            },
          }
        )
        .catch((err) => {
          // console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.discount).toEqual(
        expect.objectContaining({
          code: "HELLOWORLD",
          ends_at: null,
        })
      )
    })
  })
})

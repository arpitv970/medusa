const path = require("path")
const setupServer = require("../../../helpers/setup-server")
const { useApi } = require("../../../helpers/use-api")
const { initDb, useDb } = require("../../../helpers/use-db")

const productSeeder = require("../../helpers/store-product-seeder")
const adminSeeder = require("../../helpers/admin-seeder")
jest.setTimeout(30000)

describe("/store/products", () => {
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

  describe("GET /store/products", () => {
    beforeEach(async () => {
      try {
        await productSeeder(dbConnection)
        await adminSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("returns a list of products in collection", async () => {
      const api = useApi()

      const notExpected = [
        expect.objectContaining({ collection_id: "test-collection" }),
        expect.objectContaining({ collection_id: "test-collection1" }),
      ]

      const response = await api
        .get("/store/products?collection_id[]=test-collection2")
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "test-product_filtering_2",
          collection_id: "test-collection2",
        }),
      ])

      for (const notExpect of notExpected) {
        expect(response.data.products).toEqual(
          expect.not.arrayContaining([notExpect])
        )
      }
    })

    it("returns a list of products in with a given tag", async () => {
      const api = useApi()

      const notExpected = [expect.objectContaining({ id: "tag4" })]

      const response = await api
        .get("/store/products?tags[]=tag3")
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "test-product_filtering_1",
          collection_id: "test-collection1",
        }),
      ])

      for (const notExpect of notExpected) {
        expect(response.data.products).toEqual(
          expect.not.arrayContaining([notExpect])
        )
      }
    })

    it("returns gift card product", async () => {
      const api = useApi()

      const response = await api
        .get("/store/products?is_giftcard=true")
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.products.length).toEqual(1)
      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "giftcard",
          is_giftcard: true,
        }),
      ])
    })

    it("returns non gift card products", async () => {
      const api = useApi()

      const response = await api
        .get("/store/products?is_giftcard=false")
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)

      expect(response.data.products).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({ is_giftcard: true }),
        ])
      )
    })

    it("returns product with tag", async () => {
      const api = useApi()

      const notExpected = [expect.objectContaining({ id: "tag4" })]

      const response = await api
        .get("/store/products?tags[]=tag3")
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "test-product_filtering_1",
          collection_id: "test-collection1",
        }),
      ])

      for (const notExpect of notExpected) {
        expect(response.data.products).toEqual(
          expect.not.arrayContaining([notExpect])
        )
      }
    })

    it("returns a list of products in with a given handle", async () => {
      const api = useApi()

      const notExpected = [
        expect.objectContaining({ handle: "test-product_filtering_1" }),
      ]

      const response = await api
        .get("/store/products?handle=test-product_filtering_2")
        .catch((err) => {
          console.log(err)
        })

      expect(response.status).toEqual(200)
      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "test-product_filtering_2",
          handle: "test-product_filtering_2",
        }),
      ])

      for (const notExpect of notExpected) {
        expect(response.data.products).toEqual(
          expect.not.arrayContaining([notExpect])
        )
      }
    })

    it("returns only published products", async () => {
      const api = useApi()

      const notExpected = [
        expect.objectContaining({ status: "proposed" }),
        expect.objectContaining({ status: "draft" }),
        expect.objectContaining({ status: "rejected" }),
      ]

      const response = await api.get("/store/products").catch((err) => {
        console.log(err)
      })

      expect(response.status).toEqual(200)
      expect(response.data.products.length).toEqual(5)
      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "test-product1",
          collection_id: "test-collection",
        }),
        expect.objectContaining({
          id: "test-product",
          collection_id: "test-collection",
        }),
        expect.objectContaining({
          id: "test-product_filtering_2",
          collection_id: "test-collection2",
        }),
        expect.objectContaining({
          id: "test-product_filtering_1",
          collection_id: "test-collection1",
        }),
        expect.objectContaining({
          id: "giftcard",
        }),
      ])

      for (const notExpect of notExpected) {
        expect(response.data.products).toEqual(
          expect.not.arrayContaining([notExpect])
        )
      }
    })
  })

  describe("GET /store/products advanced pricing", () => {
    beforeEach(async () => {
      try {
        await productSeeder(dbConnection)
        await adminSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("Includes Additional prices when queried with a cart id", async () => {
      const api = useApi()

      const response = await api
        .get("/store/products?cart_id=test-cart")
        .catch((err) => {
          console.log(err)
        })

      expect(response.data.products).toEqual([
        expect.objectContaining({
          id: "test-product1",
          collection_id: "test-collection",
        }),
        expect.objectContaining({
          id: "test-product",
          collection_id: "test-collection",
          variants: [
            expect.objectContaining({
              original_price: 100,
              calculated_price: 80,
              prices: [
                expect.objectContaining({
                  id: "test-price",
                  currency_code: "usd",
                  amount: 100,
                }),
                expect.objectContaining({
                  id: "test-price-discount",
                  currency_code: "usd",
                  amount: 80,
                }),
              ],
            }),
            expect.objectContaining({
              original_price: 100,
              calculated_price: 80,
              prices: [
                expect.objectContaining({
                  id: "test-price2",
                  currency_code: "usd",
                  amount: 100,
                }),
                expect.objectContaining({
                  id: "test-price2-discount",
                  currency_code: "usd",
                  amount: 80,
                }),
              ],
            }),
            expect.objectContaining({
              original_price: 100,
              calculated_price: 80,
              prices: [
                expect.objectContaining({
                  id: "test-price1",
                  currency_code: "usd",
                  amount: 100,
                }),
                expect.objectContaining({
                  id: "test-price1-discount",
                  currency_code: "usd",
                  amount: 80,
                }),
              ],
            }),
          ],
        }),
        expect.objectContaining({
          id: "test-product_filtering_2",
          collection_id: "test-collection2",
        }),
        expect.objectContaining({
          id: "test-product_filtering_1",
          collection_id: "test-collection1",
        }),
        expect.objectContaining({
          id: "giftcard",
        }),
      ])
    })
  })

  describe("/store/products/:id", () => {
    beforeEach(async () => {
      try {
        await productSeeder(dbConnection)
        await adminSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("includes default relations", async () => {
      const api = useApi()

      const response = await api.get("/store/products/test-product")

      expect(response.data).toMatchSnapshot({
        product: {
          id: "test-product",
          variants: [
            {
              id: "test-variant",
              inventory_quantity: 10,
              allow_backorder: false,
              title: "Test variant",
              sku: "test-sku",
              ean: "test-ean",
              upc: "test-upc",
              length: null,
              manage_inventory: true,
              material: null,
              metadata: null,
              mid_code: null,
              height: null,
              hs_code: null,
              origin_country: null,
              calculated_price: 80,
              original_price: 100,
              barcode: "test-barcode",
              product_id: "test-product",
              created_at: expect.any(String),
              updated_at: expect.any(String),
              options: [
                {
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
              ],
              prices: [
                {
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  amount: 100,
                  currency_code: "usd",
                  deleted_at: null,
                  min_quantity: null,
                  max_quantity: null,
                  price_list_id: null,
                  id: "test-price",
                  region_id: null,
                  variant_id: "test-variant",
                },
                {
                  id: "test-price-discount",
                  created_at: expect.any(String),
                  min_quantity: null,
                  max_quantity: null,
                  price_list_id: "pl",
                  updated_at: expect.any(String),
                  amount: 80,
                  currency_code: "usd",
                  deleted_at: null,
                  region_id: null,
                  variant_id: "test-variant",
                  price_list: {
                    id: "pl",
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  },
                },
              ],
            },
            {
              id: "test-variant_2",
              inventory_quantity: 10,
              allow_backorder: false,
              title: "Test variant rank (2)",
              sku: "test-sku2",
              ean: "test-ean2",
              upc: "test-upc2",
              length: null,
              manage_inventory: true,
              material: null,
              metadata: null,
              mid_code: null,
              height: null,
              hs_code: null,
              origin_country: null,
              barcode: null,
              calculated_price: 80,
              original_price: 100,
              product_id: "test-product",
              created_at: expect.any(String),
              updated_at: expect.any(String),
              options: [
                {
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
              ],
              prices: [
                {
                  id: "test-price2",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  amount: 100,
                  currency_code: "usd",
                  price_list_id: null,
                  deleted_at: null,
                  region_id: null,
                  variant_id: "test-variant_2",
                },
                {
                  id: "test-price2-discount",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  amount: 80,
                  currency_code: "usd",
                  deleted_at: null,
                  region_id: null,
                  min_quantity: null,
                  max_quantity: null,
                  price_list_id: "pl",
                  variant_id: "test-variant_2",
                  price_list: {
                    id: "pl",
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  },
                },
              ],
            },
            {
              id: "test-variant_1",
              inventory_quantity: 10,
              allow_backorder: false,
              title: "Test variant rank (1)",
              sku: "test-sku1",
              ean: "test-ean1",
              upc: "test-upc1",
              length: null,
              manage_inventory: true,
              material: null,
              metadata: null,
              mid_code: null,
              height: null,
              hs_code: null,
              origin_country: null,
              calculated_price: 80,
              original_price: 100,
              barcode: "test-barcode 1",
              product_id: "test-product",
              created_at: expect.any(String),
              updated_at: expect.any(String),
              options: [
                {
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
              ],
              prices: [
                {
                  id: "test-price1",
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                  amount: 100,
                  currency_code: "usd",
                  min_quantity: null,
                  max_quantity: null,
                  price_list_id: null,
                  deleted_at: null,
                  region_id: null,
                  variant_id: "test-variant_1",
                },
                {
                  id: "test-price1-discount",
                  created_at: expect.any(String),
                  min_quantity: null,
                  max_quantity: null,
                  price_list_id: "pl",
                  updated_at: expect.any(String),
                  amount: 80,
                  currency_code: "usd",
                  deleted_at: null,
                  region_id: null,
                  variant_id: "test-variant_1",
                  price_list: {
                    id: "pl",
                    created_at: expect.any(String),
                    updated_at: expect.any(String),
                  },
                },
              ],
            },
          ],
          images: [
            {
              id: "test-image",
              created_at: expect.any(String),
              updated_at: expect.any(String),
            },
          ],
          handle: "test-product",
          title: "Test product",
          profile_id: expect.stringMatching(/^sp_*/),
          description: "test-product-description",
          collection_id: "test-collection",
          collection: {
            id: "test-collection",
            created_at: expect.any(String),
            updated_at: expect.any(String),
          },
          type: {
            id: "test-type",
            created_at: expect.any(String),
            updated_at: expect.any(String),
          },
          tags: [
            {
              id: "tag1",
              created_at: expect.any(String),
              updated_at: expect.any(String),
            },
          ],
          options: [
            {
              id: "test-option",
              values: [
                {
                  id: "test-variant-option",
                  value: "Default variant",
                  option_id: "test-option",
                  variant_id: "test-variant",
                  metadata: null,
                  deleted_at: null,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
                {
                  id: "test-variant-option-1",
                  value: "Default variant 1",
                  option_id: "test-option",
                  variant_id: "test-variant_1",
                  metadata: null,
                  deleted_at: null,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
                {
                  id: "test-variant-option-2",
                  value: "Default variant 2",
                  option_id: "test-option",
                  variant_id: "test-variant_2",
                  metadata: null,
                  deleted_at: null,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
                {
                  id: "test-variant-option-3",
                  value: "Default variant 3",
                  option_id: "test-option",
                  variant_id: "test-variant_3",
                  metadata: null,
                  deleted_at: null,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
                {
                  id: "test-variant-option-4",
                  value: "Default variant 4",
                  option_id: "test-option",
                  variant_id: "test-variant_4",
                  metadata: null,
                  deleted_at: null,
                  created_at: expect.any(String),
                  updated_at: expect.any(String),
                },
              ],
              created_at: expect.any(String),
              updated_at: expect.any(String),
            },
          ],
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      })
    })

    it("lists all published products", async () => {
      const api = useApi()

      // update test-product status to published
      await api
        .post(
          "/admin/products/test-product",
          {
            status: "published",
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

      const response = await api.get("/store/products")

      expect(response.status).toEqual(200)
      expect(response.data.products).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "test-product",
            status: "published",
          }),
        ])
      )
    })
  })
})

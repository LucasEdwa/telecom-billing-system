  /**
   * Swagger definitions for Telecom Billing System API.
   * Add this file and reference it in swaggerJsdoc's "apis" option.
   */

  /**
   * @swagger
   * tags:
   *   - name: Users
   *     description: User management and authentication
   *   - name: Usage
   *     description: Usage logging for calls, SMS, and data
   *   - name: Billing
   *     description: Bill generation, payment, and management
   *   - name: Rates
   *     description: Service rates management (admin only)
   *   - name: Stripe
   *     description: Stripe payment integration
   */

  /**
   * @swagger
   * components:
   *   securitySchemes:
   *     bearerAuth:
   *       type: http
   *       scheme: bearer
   *       bearerFormat: JWT
   *       description: JWT token obtained from login endpoint
   *   schemas:
   *     ApiResponse:
   *       type: object
   *       properties:
   *         success:
   *           type: boolean
   *         message:
   *           type: string
   *         data:
   *           type: object
   *     ValidationError:
   *       type: object
   *       properties:
   *         success:
   *           type: boolean
   *           example: false
   *         message:
   *           type: string
   *           example: Validation failed
   *         errors:
   *           type: array
   *           items:
   *             type: string
   *     Bill:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *         userId:
   *           type: integer
   *         totalAmount:
   *           type: number
   *         status:
   *           type: string
   *           enum: [PAID, UNPAID]
   *         createdAt:
   *           type: string
   *           format: date-time
   *     User:
   *       type: object
   *       properties:
   *         id:
   *           type: integer
   *         username:
   *           type: string
   *         email:
   *           type: string
   *         accountType:
   *           type: string
   *           enum: [admin, user]
   *     Rate:
   *       type: object
   *       properties:
   *         service:
   *           type: string
   *           enum: [CALL, SMS, DATA]
   *         rate:
   *           type: number
   */


  /**
   * @swagger
   * /users/signup:
   *   post:
   *     tags: [Users]
   *     summary: Register a new user
   *     description: Create a new user account with username, email, password, and account type
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - username
   *               - email
   *               - password
   *             properties:
   *               username:
   *                 type: string
   *                 example: johndoe
   *               email:
   *                 type: string
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: SecurePass123!
   *               accountType:
   *                 type: string
   *                 enum: [admin, user]
   *                 default: user
   *                 example: user
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   *       429:
   *         description: Too many requests (rate limited)
   */

  /**
   * @swagger
   * /users/login:
   *   post:
   *     tags: [Users]
   *     summary: Login and get JWT token
   *     description: Authenticate user and receive a JWT token for subsequent requests
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: john@example.com
   *               password:
   *                 type: string
   *                 format: password
   *                 example: SecurePass123!
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 token:
   *                   type: string
   *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *       401:
   *         description: Invalid credentials
   *       429:
   *         description: Too many requests (rate limited)
   */

  /**
   * @swagger
   * /users/profile/{id}:
   *   get:
   *     tags: [Users]
   *     summary: Get user profile
   *     description: Retrieve user profile information by user ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: User ID
   *         example: 1
   *     responses:
   *       200:
   *         description: User profile retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: User not found
   */

  /**
   * @swagger
   * /users/db/tables:
   *   get:
   *     tags: [Users]
   *     summary: List database tables (admin only)
   *     description: Retrieve list of all database tables. Requires admin role and API key.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: header
   *         name: x-api-key
   *         required: true
   *         schema:
   *           type: string
   *         description: API key for admin access
   *     responses:
   *       200:
   *         description: List of database tables
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin role required
   */


  /**
   * @swagger
   * /usage/calls:
   *   post:
   *     tags: [Usage]
   *     summary: Log a call
   *     description: Record call usage for a user
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - userId
   *               - duration
   *             properties:
   *               userId:
   *                 type: integer
   *                 description: ID of the user making the call
   *                 example: 1
   *               duration:
   *                 type: number
   *                 description: Call duration in minutes
   *                 example: 15.5
   *               timestamp:
   *                 type: string
   *                 format: date-time
   *                 description: Optional timestamp (defaults to current time)
   *                 example: 2026-02-08T10:30:00Z
   *     responses:
   *       201:
   *         description: Call log saved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Call log saved
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */

  /**
   * @swagger
   * /usage/sms:
   *   post:
   *     tags: [Usage]
   *     summary: Log SMS usage
   *     description: Record SMS usage for a user
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - userId
   *               - count
   *             properties:
   *               userId:
   *                 type: integer
   *                 description: ID of the user sending SMS
   *                 example: 1
   *               count:
   *                 type: integer
   *                 description: Number of SMS messages sent
   *                 example: 10
   *               timestamp:
   *                 type: string
   *                 format: date-time
   *                 description: Optional timestamp (defaults to current time)
   *                 example: 2026-02-08T10:30:00Z
   *     responses:
   *       201:
   *         description: SMS log saved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: SMS log saved
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */

  /**
   * @swagger
   * /usage/data:
   *   post:
   *     tags: [Usage]
   *     summary: Log data usage
   *     description: Record data usage for a user
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - userId
   *               - mb
   *             properties:
   *               userId:
   *                 type: integer
   *                 description: ID of the user
   *                 example: 1
   *               mb:
   *                 type: number
   *                 description: Data usage in megabytes
   *                 example: 500.25
   *               timestamp:
   *                 type: string
   *                 format: date-time
   *                 description: Optional timestamp (defaults to current time)
   *                 example: 2026-02-08T10:30:00Z
   *     responses:
   *       201:
   *         description: Data log saved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Data log saved
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */


  /**
   * @swagger
   * /billing/generate/{userId}:
   *   post:
   *     tags: [Billing]
   *     summary: Generate bill for a user
   *     description: Calculate and generate a bill based on user's usage
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: User ID to generate bill for
   *         example: 1
   *     responses:
   *       201:
   *         description: Bill generated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Bill generated successfully
   *                 data:
   *                   type: object
   *                   properties:
   *                     billId:
   *                       type: integer
   *                       example: 123
   *                     calculation:
   *                       type: object
   *                       properties:
   *                         callCharges:
   *                           type: number
   *                         smsCharges:
   *                           type: number
   *                         dataCharges:
   *                           type: number
   *                         totalAmount:
   *                           type: number
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ValidationError'
   *       401:
   *         description: Unauthorized
   *       429:
   *         description: Too many requests (rate limited)
   */

  /**
   * @swagger
   * /billing/user/{userId}:
   *   get:
   *     tags: [Billing]
   *     summary: Get bills for a user
   *     description: Retrieve paginated list of bills for a specific user
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: User ID
   *         example: 1
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 10
   *         description: Number of bills per page
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [PAID, UNPAID]
   *         description: Filter by bill status
   *     responses:
   *       200:
   *         description: Bills retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     bills:
   *                       type: array
   *                       items:
   *                         $ref: '#/components/schemas/Bill'
   *                     pagination:
   *                       type: object
   *                       properties:
   *                         page:
   *                           type: integer
   *                         limit:
   *                           type: integer
   *                         total:
   *                           type: integer
   *                         hasMore:
   *                           type: boolean
   *                         totalPages:
   *                           type: integer
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       429:
   *         description: Too many requests (rate limited)
   */

  /**
   * @swagger
   * /billing/pay:
   *   post:
   *     tags: [Billing]
   *     summary: Pay a bill
   *     description: Mark a bill as paid
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - billId
   *             properties:
   *               billId:
   *                 type: integer
   *                 minimum: 1
   *                 description: ID of the bill to pay
   *                 example: 123
   *               paymentMethodId:
   *                 type: string
   *                 description: Optional payment method ID
   *                 example: pm_1234567890
   *     responses:
   *       200:
   *         description: Bill paid successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Bill paid successfully
   *       400:
   *         description: Validation error
   *       404:
   *         description: Bill not found or already paid
   *       401:
   *         description: Unauthorized
   *       429:
   *         description: Too many requests (rate limited)
   */

  /**
   * @swagger
   * /billing/{billId}:
   *   get:
   *     tags: [Billing]
   *     summary: Get bill details
   *     description: Retrieve detailed information about a specific bill
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: billId
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *         description: Bill ID
   *         example: 123
   *     responses:
   *       200:
   *         description: Bill details retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/Bill'
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Bill not found
   *       429:
   *         description: Too many requests (rate limited)
   */


  /**
   * @swagger
   * /rates/{service}:
   *   get:
   *     tags: [Rates]
   *     summary: Get rates for a service
   *     description: Retrieve current rate for a specific service type. Requires admin role and API key.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: service
   *         required: true
   *         schema:
   *           type: string
   *           enum: [CALL, SMS, DATA]
   *         description: Service type
   *         example: CALL
   *       - in: header
   *         name: x-api-key
   *         required: true
   *         schema:
   *           type: string
   *         description: API key for admin access
   *     responses:
   *       200:
   *         description: Rates retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Rate'
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin role required
   *   put:
   *     tags: [Rates]
   *     summary: Update rate for a service
   *     description: Update the rate for a specific service type. Requires admin role and API key.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: service
   *         required: true
   *         schema:
   *           type: string
   *           enum: [CALL, SMS, DATA]
   *         description: Service type
   *         example: CALL
   *       - in: header
   *         name: x-api-key
   *         required: true
   *         schema:
   *           type: string
   *         description: API key for admin access
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - rate
   *             properties:
   *               rate:
   *                 type: number
   *                 minimum: 0
   *                 description: New rate value
   *                 example: 0.15
   *     responses:
   *       200:
   *         description: Rate updated
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Rate updated
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Admin role required
   */


  /**
   * @swagger
   * /stripe/create-payment-intent:
   *   post:
   *     tags: [Stripe]
   *     summary: Create a Stripe payment intent
   *     description: Create a payment intent for processing payments through Stripe
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - amount
   *             properties:
   *               amount:
   *                 type: integer
   *                 minimum: 1
   *                 description: Amount in cents
   *                 example: 5000
   *               currency:
   *                 type: string
   *                 default: usd
   *                 description: Currency code (default usd)
   *                 example: usd
   *     responses:
   *       200:
   *         description: Payment intent created
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 clientSecret:
   *                   type: string
   *                   description: Client secret for completing payment on frontend
   *                   example: pi_1234_secret_5678
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   *       429:
   *         description: Too many requests (rate limited)
   */

  /**
   * @swagger
   * /stripe/confirm-bill-payment:
   *   post:
   *     tags: [Stripe]
   *     summary: Confirm bill payment with Stripe
   *     description: Verify Stripe payment and mark bill as paid
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - billId
   *               - paymentIntentId
   *             properties:
   *               billId:
   *                 type: integer
   *                 description: ID of the bill to pay
   *                 example: 123
   *               paymentIntentId:
   *                 type: string
   *                 description: Stripe payment intent ID
   *                 example: pi_1234567890
   *     responses:
   *       200:
   *         description: Payment confirmed and bill marked as paid
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Bill paid successfully
   *       400:
   *         description: Validation error or payment not successful
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Bill not found
   *       429:
   *         description: Too many requests (rate limited)
   */

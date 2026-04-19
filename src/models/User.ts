import { pool } from "../database/connection";

export class User {
  constructor(
    public id: number,
    public username: string,
    public email: string,
    public password: string,
    public accountType: string,
    public createdAt: Date,
    public updatedAt: Date
  ) {}

  static async createTableIfNotExists() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        account_type ENUM('admin', 'user') NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type ENUM('CALL', 'SMS', 'DATA'),
        quantity DECIMAL(12,4) NOT NULL,
        idempotency_key VARCHAR(64) DEFAULT NULL,
        billed BOOLEAN DEFAULT FALSE,
        bill_id INT DEFAULT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_idempotency (idempotency_key),
        INDEX idx_user_id (user_id),
        INDEX idx_user_timestamp (user_id, timestamp),
        INDEX idx_unbilled (user_id, billed, timestamp),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS service_rates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        service ENUM('CALL', 'SMS', 'DATA') UNIQUE NOT NULL,
        rate DECIMAL(10,2) NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status ENUM('PAID', 'UNPAID') DEFAULT 'UNPAID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_status (user_id, status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip VARCHAR(45) NOT NULL,
        email VARCHAR(100),
        attempts INT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_ip_time (ip, created_at),
        INDEX idx_email_time (email, created_at)
      );
    `);

    // Audit Ledger: every financial event is an immutable, append-only row.
    // This is the single source of truth for money movement.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ledger (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        bill_id INT DEFAULT NULL,
        type ENUM('CHARGE', 'PAYMENT', 'ADJUSTMENT', 'REFUND') NOT NULL,
        amount DECIMAL(10,4) NOT NULL,
        balance_after DECIMAL(10,4) NOT NULL,
        description VARCHAR(255) NOT NULL,
        reference_id VARCHAR(64) DEFAULT NULL,
        created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_user_ledger (user_id, created_at),
        INDEX idx_bill_ledger (bill_id),
        INDEX idx_reference (reference_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
      );
    `);

    // Dead Letter Queue: malformed or failed CDRs land here for manual review
    // instead of being silently dropped.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dead_letter_queue (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        source_type ENUM('CALL', 'SMS', 'DATA', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
        raw_payload JSON NOT NULL,
        error_message VARCHAR(500) NOT NULL,
        error_code VARCHAR(50) DEFAULT NULL,
        retry_count INT DEFAULT 0,
        status ENUM('PENDING', 'RETRIED', 'RESOLVED', 'DISCARDED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        resolved_by INT DEFAULT NULL,
        INDEX idx_dlq_status (status, created_at),
        INDEX idx_dlq_source (source_type)
      );
    `);

    console.log("All tables created or already exist.");
  }
}

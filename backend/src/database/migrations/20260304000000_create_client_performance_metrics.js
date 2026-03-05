/**
 * Migration: Create client_performance_metrics table
 * Stores performance data from iOS/Android clients
 * Supports both MetricKit (Apple) and custom performance reports
 */

exports.up = function(knex) {
  return knex.schema.createTable('client_performance_metrics', (table) => {
    // Primary key
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));

    // Report type (metric, diagnostic, startup, network, etc.)
    table.string('report_type', 50).notNullable().index();

    // Device information (anonymous)
    table.string('device_model', 100);  // e.g., "iPhone14,2"
    table.string('os_version', 50);     // e.g., "17.0"
    table.string('app_version', 50);    // e.g., "1.0.0"
    table.string('build_number', 50);   // e.g., "42"

    // Performance metrics (JSON)
    table.jsonb('metrics').notNullable();

    // Optional metadata
    table.jsonb('metadata');

    // Timestamps
    table.timestamp('client_timestamp').notNullable();  // Client-side timestamp
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();

    // Indexes for common queries
    table.index('device_model');
    table.index('app_version');
    table.index('created_at');
    table.index(['report_type', 'created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('client_performance_metrics');
};

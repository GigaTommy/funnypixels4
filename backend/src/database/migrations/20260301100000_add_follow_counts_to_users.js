/**
 * Migration: Add cached follow counts to users table + triggers
 * Purpose: Optimize follow count queries (avoid COUNT(*) on every profile view)
 */

exports.up = function(knex) {
  return knex.schema
    // 1. Add cached count columns to users table
    .table('users', (table) => {
      table.integer('following_count').defaultTo(0).notNullable();
      table.integer('followers_count').defaultTo(0).notNullable();
    })
    // 2. Create index for sorting by followers (leaderboard)
    .then(() => {
      return knex.raw('CREATE INDEX IF NOT EXISTS idx_users_followers_count ON users(followers_count DESC)');
    })
    // 3. Initialize counts from existing user_follows data
    .then(() => {
      return knex.raw(`
        UPDATE users u
        SET following_count = (
          SELECT COUNT(*) FROM user_follows WHERE follower_id = u.id
        ),
        followers_count = (
          SELECT COUNT(*) FROM user_follows WHERE following_id = u.id
        )
      `);
    })
    // 4. Create trigger function: increment counts on follow
    .then(() => {
      return knex.raw(`
        CREATE OR REPLACE FUNCTION update_follow_counts_on_insert()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Increment follower's following_count
          UPDATE users
          SET following_count = following_count + 1
          WHERE id = NEW.follower_id;

          -- Increment following's followers_count
          UPDATE users
          SET followers_count = followers_count + 1
          WHERE id = NEW.following_id;

          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
    })
    // 5. Create trigger: call function after INSERT
    .then(() => {
      return knex.raw(`
        DROP TRIGGER IF EXISTS trigger_follow_insert ON user_follows;
        CREATE TRIGGER trigger_follow_insert
        AFTER INSERT ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts_on_insert();
      `);
    })
    // 6. Create trigger function: decrement counts on unfollow
    .then(() => {
      return knex.raw(`
        CREATE OR REPLACE FUNCTION update_follow_counts_on_delete()
        RETURNS TRIGGER AS $$
        BEGIN
          -- Decrement follower's following_count (防止负数)
          UPDATE users
          SET following_count = GREATEST(following_count - 1, 0)
          WHERE id = OLD.follower_id;

          -- Decrement following's followers_count (防止负数)
          UPDATE users
          SET followers_count = GREATEST(followers_count - 1, 0)
          WHERE id = OLD.following_id;

          RETURN OLD;
        END;
        $$ LANGUAGE plpgsql;
      `);
    })
    // 7. Create trigger: call function after DELETE
    .then(() => {
      return knex.raw(`
        DROP TRIGGER IF EXISTS trigger_follow_delete ON user_follows;
        CREATE TRIGGER trigger_follow_delete
        AFTER DELETE ON user_follows
        FOR EACH ROW
        EXECUTE FUNCTION update_follow_counts_on_delete();
      `);
    });
};

exports.down = function(knex) {
  return knex.raw('DROP TRIGGER IF EXISTS trigger_follow_delete ON user_follows')
    .then(() => knex.raw('DROP TRIGGER IF EXISTS trigger_follow_insert ON user_follows'))
    .then(() => knex.raw('DROP FUNCTION IF EXISTS update_follow_counts_on_delete()'))
    .then(() => knex.raw('DROP FUNCTION IF EXISTS update_follow_counts_on_insert()'))
    .then(() => knex.raw('DROP INDEX IF EXISTS idx_users_followers_count'))
    .then(() => knex.schema.table('users', (table) => {
      table.dropColumn('following_count');
      table.dropColumn('followers_count');
    }));
};

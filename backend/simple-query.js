const knex = require('knex')({
  client: 'postgresql',
  connection: {
    host: 'localhost',
    port: 5432,
    database: 'funnypixels_postgres',
    user: 'postgres',
    password: 'password'
  }
});

knex('device_tokens')
  .where('is_active', true)
  .orderBy('updated_at', 'desc')
  .limit(1)
  .select('device_token')
  .then(rows => {
    if (rows.length > 0) {
      process.stdout.write(rows[0].device_token);
    }
    knex.destroy();
  })
  .catch(err => {
    console.error(err.message);
    knex.destroy();
    process.exit(1);
  });

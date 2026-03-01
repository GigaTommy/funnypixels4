const knex = require('knex')({
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '',
    database: 'funnypixels_postgres'
  }
});

async function checkPixel() {
  try {
    const pixels = await knex('pixels')
      .where('grid_id', 'grid_2932939_1131364')
      .select('*');
    
    console.log('===== Pixel Data =====');
    console.log(JSON.stringify(pixels, null, 2));
    
    if (pixels.length > 0) {
      const pixel = pixels[0];
      console.log('\n===== Analysis =====');
      console.log('color:', pixel.color);
      console.log('pattern_id:', pixel.pattern_id);
      console.log('alliance_id:', pixel.alliance_id);
      console.log('user_id:', pixel.user_id);
      console.log('pixel_type:', pixel.pixel_type);
      
      // Check user avatar
      if (pixel.user_id) {
        const users = await knex('users')
          .where('id', pixel.user_id)
          .select('id', 'username', 'avatar_url');
        console.log('\n===== User Data =====');
        console.log(JSON.stringify(users, null, 2));
      }
    }
    
    await knex.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkPixel();

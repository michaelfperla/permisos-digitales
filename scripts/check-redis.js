// scripts/check-redis.js
const { createClient } = require('redis');
require('dotenv').config();

async function checkRedisConnection() {
  // Get Redis configuration from environment variables
  const redisUrl = process.env.REDIS_URL;
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = process.env.REDIS_PORT || 6379;
  const redisPassword = process.env.REDIS_PASSWORD;

  let client;

  try {
    console.log('Attempting to connect to Redis...');
    
    // Create Redis client based on available configuration
    if (redisUrl) {
      console.log(`Using Redis URL: ${redisUrl}`);
      client = createClient({ url: redisUrl });
    } else {
      console.log(`Using Redis Host/Port: ${redisHost}:${redisPort}`);
      const options = {
        socket: {
          host: redisHost,
          port: redisPort
        }
      };
      
      if (redisPassword) {
        options.password = redisPassword;
      }
      
      client = createClient(options);
    }

    // Set up error handler
    client.on('error', (err) => {
      console.error('Redis Error:', err);
    });

    // Connect to Redis
    await client.connect();
    
    // Check connection by setting and getting a test value
    console.log('Connected to Redis successfully!');
    
    // Set a test key
    await client.set('test-connection', 'success');
    const testValue = await client.get('test-connection');
    console.log(`Test key value: ${testValue}`);
    
    // Clean up
    await client.del('test-connection');
    
    // Quit the client
    await client.quit();
    console.log('Redis connection test completed successfully.');
    return true;
  } catch (error) {
    console.error('Failed to connect to Redis:', error.message);
    if (client) {
      try {
        await client.quit();
      } catch (e) {
        // Ignore errors during quit
      }
    }
    return false;
  }
}

// Run the check
checkRedisConnection()
  .then(success => {
    if (!success) {
      console.log('\nRedis connection failed. Please check:');
      console.log('1. Redis server is installed and running');
      console.log('2. Redis configuration in .env file is correct');
      console.log('3. No firewall is blocking the connection');
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });

// Node.js script to clean up Green price curve data
// Save as cleanup-green-prices.js and run with: node cleanup-green-prices.js

const { MongoClient } = require('mongodb');

async function cleanupGreenPrices() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'energy_contracts');
    const collection = db.collection('price_curves');
    
    console.log('Connected to MongoDB');
    
    // 1. Check current Green data
    console.log('\n=== Current Green Price Data ===');
    const currentGreenData = await collection.find({type: "green"}).toArray();
    console.log(`Found ${currentGreenData.length} existing Green records`);
    
    // Show breakdown by profile
    const profileBreakdown = {};
    currentGreenData.forEach(record => {
      profileBreakdown[record.profile] = (profileBreakdown[record.profile] || 0) + 1;
    });
    
    console.log('Current Green profiles:');
    Object.entries(profileBreakdown).forEach(([profile, count]) => {
      console.log(`  ${profile}: ${count} records`);
    });
    
    // 2. Find Solar Green records to copy
    const solarGreenRecords = await collection.find({
      type: "green",
      profile: "solar"
    }).toArray();
    
    console.log(`\nFound ${solarGreenRecords.length} Solar Green records to copy`);
    
    if (solarGreenRecords.length === 0) {
      console.log('ERROR: No Solar Green records found!');
      
      // Show what profiles we do have
      const availableProfiles = await collection.distinct("profile", {type: "green"});
      console.log('Available Green profiles:', availableProfiles);
      return;
    }
    
    // 3. Check if baseload Green already exists
    const existingBaseload = await collection.countDocuments({
      type: "green",
      profile: "baseload"
    });
    
    if (existingBaseload > 0) {
      console.log(`\nWARNING: ${existingBaseload} baseload Green records already exist`);
      console.log('Do you want to delete them first? (modify script to proceed)');
      
      // Uncomment the next line to delete existing baseload Green records
      // await collection.deleteMany({type: "green", profile: "baseload"});
      // console.log('Deleted existing baseload Green records');
    }
    
    // 4. Create new baseload Green records
    const newBaseloadRecords = solarGreenRecords.map(solarRecord => ({
      ...solarRecord,
      _id: undefined, // Remove the _id to create new records
      profile: "baseload"  // Change profile from solar to baseload
    }));
    
    console.log(`\nPreparing to insert ${newBaseloadRecords.length} new baseload Green records`);
    
    // Show sample of what will be created
    console.log('\nSample of new records:');
    newBaseloadRecords.slice(0, 3).forEach(record => {
      console.log(`  ${record.state} - ${record.year}-${record.month.toString().padStart(2, '0')} - $${record.price}`);
    });
    
    // 5. Insert new records
    if (newBaseloadRecords.length > 0) {
      const insertResult = await collection.insertMany(newBaseloadRecords);
      console.log(`\nSUCCESS: Inserted ${insertResult.insertedIds.length} new baseload Green records`);
    }
    
    // 6. Verify results
    console.log('\n=== Final Green Price Data ===');
    const finalGreenData = await collection.find({type: "green"}).toArray();
    const finalProfileBreakdown = {};
    finalGreenData.forEach(record => {
      finalProfileBreakdown[record.profile] = (finalProfileBreakdown[record.profile] || 0) + 1;
    });
    
    console.log('Final Green profiles:');
    Object.entries(finalProfileBreakdown).forEach(([profile, count]) => {
      console.log(`  ${profile}: ${count} records`);
    });
    
    // 7. Test the price curve API
    console.log('\n=== Testing Price Curve API ===');
    console.log('You can now test these URLs:');
    console.log('- Green Baseload: /api/price-curves?type=Green&profile=baseload');
    console.log('- Green Solar: /api/price-curves?type=Green&profile=solar');
    
    // Show sample of baseload data for each state
    const states = await collection.distinct("state", {type: "green", profile: "baseload"});
    console.log(`\nAvailable states for Green baseload: ${states.join(', ')}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup
cleanupGreenPrices().catch(console.error);
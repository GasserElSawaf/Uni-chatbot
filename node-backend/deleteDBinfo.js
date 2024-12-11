const { MongoClient } = require("mongodb");

// MongoDB connection URI and database/collection names
const uri = "mongodb://localhost:27017";
const dbName = "userDatabase";
const collectionName = "registrations";

// Function to delete all data from the collection
async function deleteAllData() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Delete all documents
    const result = await collection.deleteMany({});
    console.log(`Deleted ${result.deletedCount} document(s) from the collection.`);
  } catch (error) {
    console.error("Error deleting data:", error);
  } finally {
    await client.close();
  }
}

// Call the function
deleteAllData();

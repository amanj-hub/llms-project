const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    
    // We only need the mongoose connection. We will find all users without a username.
    // Using a dynamic model just to get access to the users collection
    const UserSchema = new mongoose.Schema({
      name: String,
      email: String,
      username: String
    }, { strict: false });
    
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const users = await User.find({ username: { $exists: false } });
    console.log(`Found ${users.length} users without username`);

    for (let user of users) {
      // Create a username from email or name
      let baseUsername = user.email ? user.email.split('@')[0] : (user.name ? user.name.replace(/\s+/g, '').toLowerCase() : 'user');
      let username = baseUsername;
      
      // Ensure it's unique
      let counter = 1;
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      
      user.username = username;
      await user.save();
      console.log(`Updated user ${user.email} with username: ${username}`);
    }

    console.log('Migration complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('DB Error', err);
    process.exit(1);
  });

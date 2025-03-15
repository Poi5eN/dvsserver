const mongoose = require('mongoose');
const Collection = require('./models/adminModel'); // Adjust path as needed
require('dotenv').config();

const generateSlug = (schoolName) => {
  return schoolName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9-]/g, '');
};

const migrateSlugs = async () => {
  try {
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    const admins = await Collection.find({ slug: { $exists: false } });

    if (admins.length === 0) {
      console.log('No admins need slug migration');
      process.exit(0);
    }

    console.log(`Found ${admins.length} admins without slugs`);

    for (const admin of admins) {
      const slug = generateSlug(admin.schoolName);

      // Check for existing slug conflicts
      const existingAdmin = await Collection.findOne({ slug });
      if (existingAdmin) {
        console.warn(`Slug conflict for ${admin.schoolName}. Appending ID...`);
        admin.slug = `${slug}-${admin._id.toString().slice(-4)}`;
      } else {
        admin.slug = slug;
      }

      await admin.save();
      console.log(`Updated slug for ${admin.schoolName}: ${admin.slug}`);
    }

    console.log('Slug migration completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

migrateSlugs();
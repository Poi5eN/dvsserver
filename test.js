// You can run this in a Node.js script
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://digitalvidyasaarthidvs:digitalvidyasaarthidvs@cluster0.zjnwc.mongodb.net/DigitalVidyaSaarthi');
const SuperAdmin = require('./models/superAdminModel');

async function checkSuperAdmins() {
  const admins = await SuperAdmin.find({});
  console.log('Total SuperAdmins:', admins.length);
  console.log('SuperAdmins:', admins.map(admin => admin.email));
}

checkSuperAdmins();
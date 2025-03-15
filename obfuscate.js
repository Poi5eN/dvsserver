const obfuscator = require('javascript-obfuscator');
const fs = require('fs');
const path = require('path');

const folders = ['config', 'controllers', 'middleware', 'models', 'routes', 'utils',];
const files = ['app.js', 'server.js', 'migrateSlugs.js'];
const distDir = './dist';

// Create dist folder if it doesn't exist
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir);

// Obfuscate folders
folders.forEach(folder => {
  if (!fs.existsSync(folder)) {
    console.log(`Skipping folder: ${folder} (does not exist)`);
    return;
  }
  const distFolder = path.join(distDir, folder);
  if (!fs.existsSync(distFolder)) fs.mkdirSync(distFolder);

  fs.readdirSync(folder).forEach(file => {
    if (!file.endsWith('.js')) {
      console.log(`Skipping file: ${folder}/${file} (not a .js file)`);
      return;
    }
    console.log(`Processing: ${folder}/${file}`);
    const code = fs.readFileSync(path.join(folder, file), 'utf8');
    try {
      const obfuscated = obfuscator.obfuscate(code).getObfuscatedCode();
      fs.writeFileSync(path.join(distFolder, file), obfuscated);
      console.log(`Obfuscated: ${folder}/${file}`);
    } catch (error) {
      console.error(`Error obfuscating ${folder}/${file}: ${error.message}`);
    }
  });
});

// Obfuscate root files
files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`Skipping file: ${file} (does not exist)`);
    return;
  }
  console.log(`Processing: ${file}`);
  const code = fs.readFileSync(file, 'utf8');
  try {
    const obfuscated = obfuscator.obfuscate(code).getObfuscatedCode();
    fs.writeFileSync(path.join(distDir, file), obfuscated);
    console.log(`Obfuscated: ${file}`);
  } catch (error) {
    console.error(`Error obfuscating ${file}: ${error.message}`);
  }
});

console.log('Obfuscation complete!');
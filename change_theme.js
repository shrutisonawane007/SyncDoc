/* eslint-disable */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getFiles(fullPath, files);
    } else if (stat.isFile() && (item.endsWith('.tsx') || item.endsWith('.ts') || item.endsWith('.css') || item.endsWith('.css.map'))) {
      files.push(fullPath);
    }
  }
  return files;
}

function replaceColors() {
  const files = getFiles(srcDir);
  console.log(`Found ${files.length} files to update...`);

  let replacedCount = 0;
  for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Case sensitive replacements for Tailwind classes
    const updated = content
      .replace(/indigo/g, 'orange')
      .replace(/Indigo/g, 'Orange')
      .replace(/#6366f1/g, '#f97316') // Indigo-500 hex
      .replace(/#4f46e5/g, '#ea580c'); // Indigo-600 hex

    if (updated !== content) {
      fs.writeFileSync(file, updated, 'utf8');
      console.log(`Updated: ${path.relative(__dirname, file)}`);
      replacedCount++;
    }
  }

  // Update globals.css values manually to make the background a clean white with grey details
  const globalsPath = path.join(srcDir, 'app', 'globals.css');
  if (fs.existsSync(globalsPath)) {
    let content = fs.readFileSync(globalsPath, 'utf8');
    
    // Replace light mode variables to be pure white and clear greys/oranges
    content = content.replace(/--background:\s*#f8fafc;/g, '--background: #ffffff; /* Pure White background */')
                     .replace(/--card-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.7\);/g, '--card-bg: rgba(243, 244, 246, 0.6); /* Soft Grey card background */')
                     .replace(/--card-border:\s*rgba\(148,\s*163,\s*184,\s*0\.12\);/g, '--card-border: rgba(229, 231, 235, 0.5); /* Neutral border */')
                     .replace(/--accent-color:\s*#6366f1;/g, '--accent-color: #ea580c; /* Bright Orange */')
                     .replace(/--accent-hover:\s*#4f46e5;/g, '--accent-hover: #c2410c; /* Deep Orange */');

    fs.writeFileSync(globalsPath, content, 'utf8');
    console.log('Explicitly updated globals.css variable shades.');
  }

  console.log(`\nSuccess! Updated ${replacedCount} files with the new Orange, White, and Grey theme!`);
}

replaceColors();

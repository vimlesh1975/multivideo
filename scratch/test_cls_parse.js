const clsOutput = `200 CLS OK
"AMB"  MOVIE  13706316  20170119124403  52
"CG1080I50"  MOVIE  22915  20101118094832  5
"DIR1/FILE1"  MOVIE  8656114  20170119124403  52
"DIR1/SUBDIR1/FILE2"  MOVIE  8656114  20170119124403  52
"IMAGES/LOGO"  STILL  1234  20170119124403  1
`;

function parseCls(output) {
  const lines = output.split('\n');
  const files = [];
  
  for (const line of lines) {
    const match = line.match(/"([^"]+)"/);
    if (match) {
      files.push(match[1]);
    }
  }
  
  return files;
}

function buildTree(paths) {
  const root = { name: 'Root', children: {}, type: 'folder' };
  
  paths.forEach(path => {
    const parts = path.split('/');
    let current = root;
    
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // It's a file
        current.children[part] = { name: part, type: 'file', path: path };
      } else {
        // It's a folder
        if (!current.children[part]) {
          current.children[part] = { name: part, type: 'folder', children: {} };
        }
        current = current.children[part];
      }
    });
  });
  
  return root;
}

const paths = parseCls(clsOutput);
const tree = buildTree(paths);
console.log(JSON.stringify(tree, null, 2));

const fs = require('fs');
const pdfParse = require('pdf-parse');

async function testPdfParse(pdfPath) {
  try {
    console.log(`Testing PDF parsing for file: ${pdfPath}`);
    
    // Read the PDF file
    const dataBuffer = fs.readFileSync(pdfPath);
    
    // Parse the PDF
    console.log('Extracting text from PDF...');
    const data = await pdfParse(dataBuffer);
    
    // Log results
    console.log('\nPDF Parsing Results:');
    console.log('-------------------');
    console.log(`Number of pages: ${data.numpages}`);
    console.log(`Characters extracted: ${data.text.length}`);
    console.log('\nFirst 500 characters of extracted text:');
    console.log(data.text.substring(0, 500));
    
    return {
      success: true,
      pages: data.numpages,
      characters: data.text.length,
      text: data.text
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Check if a file path was provided as a command line argument
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Please provide a path to a PDF file as an argument.');
  console.error('Usage: node test-pdf-parse.js path/to/pdf/file.pdf');
  process.exit(1);
}

// Run the test
testPdfParse(pdfPath)
  .then(result => {
    if (result.success) {
      console.log('\nTest completed successfully!');
      process.exit(0);
    } else {
      console.error('\nTest failed:', result.error);
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });

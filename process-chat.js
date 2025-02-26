// The Idea of Us - Main Processing Script (Updated)
// This script orchestrates the entire data processing pipeline using the custom parser

const fs = require('fs');
const path = require('path');
const { processChat } = require('./custom-chat-parser');
const { processAnalysis } = require('./data-analyzer');
const { processVisualizationData } = require('./visualization-prep');

/**
 * Create directory if it doesn't exist
 * @param {string} dirPath - Directory path to create
 */
function ensureDirExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Run the complete data processing pipeline
 * @param {string} inputFilePath - Path to the chat export
 * @param {string} outputDir - Directory to save all output files
 */
function runPipeline(inputFilePath, outputDir = './output') {
  console.log('Starting chat analysis pipeline...');
  console.log(`Input file: ${inputFilePath}`);
  
  // Ensure output directory exists
  ensureDirExists(outputDir);
  
  // Define output file paths
  const parsedDataPath = path.join(outputDir, 'parsed_messages.json');
  const analysisPath = path.join(outputDir, 'analysis_results.json');
  const visualizationDataPath = path.join(outputDir, 'visualization_data.json');
  
  // Step 1: Parse chat using the custom parser
  console.log('\n--- Step 1: Parsing chat ---');
  const messages = processChat(inputFilePath, parsedDataPath);
  
  if (!messages || messages.length === 0) {
    console.error('Failed to parse chat or no messages found. Pipeline aborted.');
    return;
  }
  
  // Step 2: Analyze chat data
  console.log('\n--- Step 2: Analyzing chat data ---');
  const analysis = processAnalysis(parsedDataPath, analysisPath);
  
  if (!analysis) {
    console.error('Failed to analyze chat data. Pipeline aborted.');
    return;
  }
  
  // Step 3: Prepare visualization data
  console.log('\n--- Step 3: Preparing visualization data ---');
  const visData = processVisualizationData(analysisPath, visualizationDataPath);
  
  if (!visData) {
    console.error('Failed to prepare visualization data. Pipeline aborted.');
    return;
  }
  
  console.log('\n--- Pipeline completed successfully! ---');
  console.log(`Processed ${messages.length} messages`);
  console.log(`Output files saved to: ${outputDir}`);
  console.log('- Parsed messages: parsed_messages.json');
  console.log('- Analysis results: analysis_results.json');
  console.log('- Visualization data: visualization_data.json');
  
  // Print basic stats
  console.log('\nBasic Chat Statistics:');
  console.log(`- Total messages: ${analysis.basicStats.messageCount}`);
  console.log(`- Participants: ${analysis.basicStats.uniqueSenders.join(', ')}`);
  console.log(`- Time span: ${analysis.basicStats.firstMessageDate} to ${analysis.basicStats.lastMessageDate}`);
  console.log(`- Duration: ${Math.round(analysis.basicStats.durationDays)} days`);
  
  return {
    messages,
    analysis,
    visData
  };
}

// Check if this script is being run directly
if (require.main === module) {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.error('Usage: node process-chat.js <path-to-chat.txt> [output-directory]');
    process.exit(1);
  }
  
  const inputFilePath = args[0];
  const outputDir = args.length > 1 ? args[1] : './output';
  
  // Run the pipeline
  runPipeline(inputFilePath, outputDir);
} else {
  // Being imported as a module
  module.exports = {
    runPipeline
  };
}
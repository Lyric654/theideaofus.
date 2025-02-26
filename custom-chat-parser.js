// Custom Chat Parser for the specific format:
// [DD/MM/YY, HH:MM:SS PM] Sender: Message

const fs = require('fs');
const path = require('path');

/**
 * Parse a custom format chat export file
 * @param {string} filePath - Path to the chat export text file
 * @returns {Array} - Array of message objects with parsed data
 */
function parseCustomChat(filePath) {
  // Read the file
  const chatText = fs.readFileSync(filePath, 'utf8');
  
  // Split by new lines
  const lines = chatText.split('\n');
  
  // Regular expression to match the custom format
  // Format: [DD/MM/YY, HH:MM:SS PM] Sender: Message
  const customPattern = /^\[(\d{2}\/\d{2}\/\d{2}),\s(\d{1,2}:\d{2}:\d{2}\s[AP]M)\]\s(.+?):\s(.+)$/;
  
  // Alternative pattern without seconds
  // Format: [DD/MM/YY, HH:MM PM] Sender: Message
  const altPattern = /^\[(\d{2}\/\d{2}\/\d{2}),\s(\d{1,2}:\d{2}\s[AP]M)\]\s(.+?):\s(.+)$/;
  
  // Array to store parsed messages
  const messages = [];
  
  // Current message being built (for multi-line messages)
  let currentMessage = null;
  
  // Process each line
  lines.forEach((line, lineIndex) => {
    // Skip empty lines
    if (line.trim() === '') return;
    
    // Try to match with both patterns
    let match = line.match(customPattern);
    if (!match) {
      match = line.match(altPattern);
    }
    
    if (match) {
      // If we were building a previous message, save it
      if (currentMessage) {
        messages.push(currentMessage);
      }
      
      // Extract data from the match
      const [_, date, time, sender, content] = match;
      
      // Parse the date (DD/MM/YY format)
      const dateParts = date.split('/');
      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1; // JS months are 0-indexed
      let year = parseInt(dateParts[2]);
      // Add 2000 to get the full year (assuming 20XX)
      if (year < 100) {
        year += 2000;
      }
      
      // Parse the time (with AM/PM)
      let hour = 0;
      let minute = 0;
      let second = 0;
      const isPM = time.includes('PM');
      
      const timeParts = time.split(':');
      hour = parseInt(timeParts[0]);
      
      // Handle 12-hour format
      if (isPM && hour < 12) {
        hour += 12;
      } else if (!isPM && hour === 12) {
        hour = 0;
      }
      
      minute = parseInt(timeParts[1]);
      
      // Handle seconds if present
      if (timeParts.length > 2) {
        // Extract seconds by removing any "AM" or "PM" suffix
        second = parseInt(timeParts[2].replace(/\s[AP]M/, ''));
      }
      
      // Create timestamp
      const timestamp = new Date(year, month, day, hour, minute, second);
      
      // Create new message object
      currentMessage = {
        timestamp,
        date: date,
        time: time,
        sender: sender.trim(),
        content: content,
        isMedia: content.includes('image omitted') || 
                content.includes('video omitted') ||
                content.includes('audio omitted') ||
                content.includes('sticker omitted') ||
                content.includes('GIF omitted') ||
                content.includes('document omitted'),
        isDeleted: content.includes('This message was deleted') || 
                  content.includes('You deleted this message'),
        lineNumber: lineIndex + 1
      };
    } else if (currentMessage) {
      // This line is a continuation of the previous message
      currentMessage.content += '\n' + line;
    } else {
      console.log(`Warning: Line ${lineIndex + 1} doesn't match any expected format: ${line}`);
    }
  });
  
  // Don't forget to add the last message
  if (currentMessage) {
    messages.push(currentMessage);
  }
  
  console.log(`Successfully parsed ${messages.length} messages from chat file`);
  return messages;
}

/**
 * Save parsed messages to a JSON file
 * @param {Array} messages - Array of parsed message objects
 * @param {string} outputPath - Path to save the output JSON file
 */
function saveToJson(messages, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(messages, null, 2));
  console.log(`Saved ${messages.length} messages to ${outputPath}`);
}

/**
 * Main function to process a chat export
 * @param {string} inputFilePath - Path to the chat export
 * @param {string} outputFilePath - Path to save the parsed JSON
 */
function processChat(inputFilePath, outputFilePath) {
  console.log(`Processing chat: ${inputFilePath}`);
  
  try {
    // Parse the chat
    const messages = parseCustomChat(inputFilePath);
    
    // Save to JSON
    saveToJson(messages, outputFilePath);
    
    console.log('Processing complete!');
    return messages;
  } catch (error) {
    console.error('Error processing chat:', error);
    return null;
  }
}

module.exports = {
  parseCustomChat,
  saveToJson,
  processChat
};
// WhatsApp Conversation Analysis
// This script analyzes the parsed WhatsApp data to extract patterns and insights

const fs = require('fs');
const natural = require('natural'); // Natural language processing library
const sentiment = require('sentiment'); // Simple sentiment analysis

/**
 * Extract time-based patterns from messages
 * @param {Array} messages - Array of message objects
 * @returns {Object} - Object containing temporal analysis
 */
function analyzeTemporalPatterns(messages) {
  // Group messages by day
  const messagesByDay = {};
  const messagesByHour = Array(24).fill(0);
  const messagesByMonth = {};
  const responseTimesBySender = {};
  
  messages.forEach((message, index) => {
    const timestamp = new Date(message.timestamp);
    const sender = message.sender;
    
    // Format date as YYYY-MM-DD for grouping
    const day = timestamp.toISOString().slice(0, 10);
    const month = timestamp.toISOString().slice(0, 7);
    const hour = timestamp.getHours();
    
    // Count messages by day
    messagesByDay[day] = messagesByDay[day] || 0;
    messagesByDay[day]++;
    
    // Count messages by hour
    messagesByHour[hour]++;
    
    // Count messages by month
    messagesByMonth[month] = messagesByMonth[month] || 0;
    messagesByMonth[month]++;
    
    // Calculate response times (if this isn't the first message)
    if (index > 0) {
      const prevMessage = messages[index - 1];
      const prevSender = prevMessage.sender;
      
      // Only calculate if this is a different sender (a response)
      if (sender !== prevSender) {
        const prevTimestamp = new Date(prevMessage.timestamp);
        const responseTime = (timestamp - prevTimestamp) / 1000 / 60; // in minutes
        
        // Only count reasonable response times (less than 24 hours)
        if (responseTime < 24 * 60) {
          responseTimesBySender[sender] = responseTimesBySender[sender] || [];
          responseTimesBySender[sender].push(responseTime);
        }
      }
    }
  });
  
  // Calculate average response times
  const avgResponseTimes = {};
  for (const [sender, times] of Object.entries(responseTimesBySender)) {
    avgResponseTimes[sender] = times.reduce((sum, time) => sum + time, 0) / times.length;
  }
  
  return {
    messagesByDay,
    messagesByHour,
    messagesByMonth,
    responseTimesBySender,
    avgResponseTimes
  };
}

/**
 * Analyze content patterns in messages
 * @param {Array} messages - Array of message objects
 * @returns {Object} - Object containing content analysis
 */
function analyzeContentPatterns(messages) {
  const tokenizer = new natural.WordTokenizer();
  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();
  
  // Word frequency by sender
  const wordsBySender = {};
  // Emoji usage by sender
  const emojisBySender = {};
  // Message length by sender
  const lengthsBySender = {};
  // Media messages by sender
  const mediaBySender = {};
  
  // Regex for basic emoji detection (simplified)
  const emojiRegex = /[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu;
  
  // Process each message
  messages.forEach(message => {
    const sender = message.sender;
    const content = message.content;
    
    // Initialize sender objects if needed
    wordsBySender[sender] = wordsBySender[sender] || {};
    emojisBySender[sender] = emojisBySender[sender] || {};
    lengthsBySender[sender] = lengthsBySender[sender] || [];
    mediaBySender[sender] = mediaBySender[sender] || 0;
    
    // Track message length
    lengthsBySender[sender].push(content.length);
    
    // Track media messages
    if (message.isMedia) {
      mediaBySender[sender]++;
    } else {
      // Add document to TF-IDF for topic analysis
      tfidf.addDocument(content);
      
      // Count word frequency
      const words = tokenizer.tokenize(content.toLowerCase());
      words.forEach(word => {
        wordsBySender[sender][word] = wordsBySender[sender][word] || 0;
        wordsBySender[sender][word]++;
      });
      
      // Count emoji usage
      const emojis = content.match(emojiRegex) || [];
      emojis.forEach(emoji => {
        emojisBySender[sender][emoji] = emojisBySender[sender][emoji] || 0;
        emojisBySender[sender][emoji]++;
      });
    }
  });
  
  // Calculate average message length by sender
  const avgLengthBySender = {};
  for (const [sender, lengths] of Object.entries(lengthsBySender)) {
    avgLengthBySender[sender] = lengths.reduce((sum, length) => sum + length, 0) / lengths.length;
  }
  
  // Extract top keywords by TF-IDF for basic topic modeling
  const topicsByMonth = {};
  const messagesByMonth = {};
  
  messages.forEach(message => {
    if (!message.isMedia) {
      const timestamp = new Date(message.timestamp);
      const month = timestamp.toISOString().slice(0, 7);
      
      messagesByMonth[month] = messagesByMonth[month] || [];
      messagesByMonth[month].push(message.content);
    }
  });
  
  // Extract topics for each month
  for (const [month, monthMessages] of Object.entries(messagesByMonth)) {
    const monthTfidf = new TfIdf();
    
    // Add all messages from this month
    monthMessages.forEach(content => {
      monthTfidf.addDocument(content);
    });
    
    // Get top 10 terms for this month
    const terms = [];
    monthTfidf.listTerms(0).slice(0, 10).forEach(item => {
      terms.push({ term: item.term, tfidf: item.tfidf });
    });
    
    topicsByMonth[month] = terms;
  }
  
  return {
    wordsBySender,
    emojisBySender,
    avgLengthBySender,
    mediaBySender,
    topicsByMonth
  };
}

/**
 * Analyze sentiment patterns in messages
 * @param {Array} messages - Array of message objects
 * @returns {Object} - Object containing sentiment analysis
 */
function analyzeSentiment(messages) {
  const sentimentAnalyzer = new sentiment();
  const sentimentByMonth = {};
  const sentimentBySender = {};
  const sentimentTimeline = [];
  
  messages.forEach(message => {
    const sender = message.sender;
    const content = message.content;
    const timestamp = new Date(message.timestamp);
    const month = timestamp.toISOString().slice(0, 7);
    
    // Skip media and deleted messages
    if (!message.isMedia && !message.isDeleted) {
      // Analyze sentiment
      const result = sentimentAnalyzer.analyze(content);
      
      // Track by month
      sentimentByMonth[month] = sentimentByMonth[month] || [];
      sentimentByMonth[month].push(result.score);
      
      // Track by sender
      sentimentBySender[sender] = sentimentBySender[sender] || [];
      sentimentBySender[sender].push(result.score);
      
      // Add to timeline
      sentimentTimeline.push({
        timestamp: timestamp.toISOString(),
        sender,
        score: result.score,
        comparative: result.comparative
      });
    }
  });
  
  // Calculate average sentiment by month
  const avgSentimentByMonth = {};
  for (const [month, scores] of Object.entries(sentimentByMonth)) {
    avgSentimentByMonth[month] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
  
  // Calculate average sentiment by sender
  const avgSentimentBySender = {};
  for (const [sender, scores] of Object.entries(sentimentBySender)) {
    avgSentimentBySender[sender] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }
  
  return {
    sentimentTimeline,
    avgSentimentByMonth,
    avgSentimentBySender
  };
}

/**
 * Identify relationship pattern shifts over time
 * @param {Array} messages - Array of message objects
 * @returns {Object} - Object containing relationship pattern analysis
 */
function analyzeRelationshipPatterns(messages) {
  // Window size for detecting pattern changes (in days)
  const WINDOW_SIZE = 30;
  
  // Group messages by day
  const messagesByDay = {};
  messages.forEach(message => {
    const timestamp = new Date(message.timestamp);
    const day = timestamp.toISOString().slice(0, 10);
    
    messagesByDay[day] = messagesByDay[day] || [];
    messagesByDay[day].push(message);
  });
  
  // Sort days chronologically
  const sortedDays = Object.keys(messagesByDay).sort();
  
  // Calculate metrics for each window
  const windowMetrics = [];
  
  for (let i = 0; i < sortedDays.length - WINDOW_SIZE; i += Math.ceil(WINDOW_SIZE / 2)) {
    const windowDays = sortedDays.slice(i, i + WINDOW_SIZE);
    const windowMessages = [];
    
    windowDays.forEach(day => {
      windowMessages.push(...messagesByDay[day]);
    });
    
    // Calculate metrics for this window
    const startDate = windowDays[0];
    const endDate = windowDays[windowDays.length - 1];
    
    // Count messages by sender
    const messagesBySender = {};
    windowMessages.forEach(message => {
      const sender = message.sender;
      messagesBySender[sender] = messagesBySender[sender] || 0;
      messagesBySender[sender]++;
    });
    
    // Calculate response frequency
    let responseCount = 0;
    for (let j = 1; j < windowMessages.length; j++) {
      if (windowMessages[j].sender !== windowMessages[j-1].sender) {
        responseCount++;
      }
    }
    
    // Calculate average messages per day
    const messagesPerDay = windowMessages.length / windowDays.length;
    
    // Analyze content for this window
    const contentAnalysis = analyzeContentPatterns(windowMessages);
    
    // Analyze sentiment for this window
    const sentimentAnalysis = analyzeSentiment(windowMessages);
    
    // Add metrics for this window
    windowMetrics.push({
      startDate,
      endDate,
      messageCount: windowMessages.length,
      messagesBySender,
      messagesPerDay,
      responseFrequency: responseCount / windowMessages.length,
      avgMessageLength: Object.values(contentAnalysis.avgLengthBySender),
      avgSentiment: Object.values(sentimentAnalysis.avgSentimentBySender)
    });
  }
  
  // Detect significant changes between consecutive windows
  const patternShifts = [];
  
  for (let i = 1; i < windowMetrics.length; i++) {
    const prevWindow = windowMetrics[i-1];
    const currWindow = windowMetrics[i];
    
    // Calculate change in message frequency
    const frequencyChange = (currWindow.messagesPerDay - prevWindow.messagesPerDay) / prevWindow.messagesPerDay;
    
    // Calculate change in response frequency
    const responseChange = (currWindow.responseFrequency - prevWindow.responseFrequency) / prevWindow.responseFrequency;
    
    // If there's a significant change in any metric, record a pattern shift
    if (Math.abs(frequencyChange) > 0.3 || Math.abs(responseChange) > 0.3) {
      patternShifts.push({
        date: currWindow.startDate,
        metrics: {
          frequencyChange,
          responseChange
        },
        prevWindow,
        currWindow
      });
    }
  }
  
  return {
    windowMetrics,
    patternShifts
  };
}

/**
 * Comprehensive analysis of WhatsApp chat data
 * @param {Array} messages - Array of parsed message objects
 * @returns {Object} - Object containing all analysis results
 */
function analyzeWhatsAppChat(messages) {
  console.log(`Analyzing ${messages.length} messages...`);
  
  // Get basic stats
  const uniqueSenders = [...new Set(messages.map(m => m.sender))];
  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const duration = new Date(lastMessage.timestamp) - new Date(firstMessage.timestamp);
  const durationDays = duration / (1000 * 60 * 60 * 24);
  
  // Run various analyses
  const temporalAnalysis = analyzeTemporalPatterns(messages);
  const contentAnalysis = analyzeContentPatterns(messages);
  const sentimentAnalysis = analyzeSentiment(messages);
  const relationshipAnalysis = analyzeRelationshipPatterns(messages);
  
  return {
    basicStats: {
      messageCount: messages.length,
      uniqueSenders,
      firstMessageDate: firstMessage.date,
      lastMessageDate: lastMessage.date,
      durationDays
    },
    temporalAnalysis,
    contentAnalysis,
    sentimentAnalysis,
    relationshipAnalysis
  };
}

/**
 * Save analysis results to a JSON file
 * @param {Object} analysis - Analysis results
 * @param {string} outputPath - Path to save the output JSON file
 */
function saveAnalysis(analysis, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2));
  console.log(`Saved analysis to ${outputPath}`);
}

/**
 * Main function to analyze a WhatsApp chat
 * @param {string} inputFilePath - Path to the parsed WhatsApp chat JSON
 * @param {string} outputFilePath - Path to save the analysis results
 */
function processAnalysis(inputFilePath, outputFilePath) {
  console.log(`Analyzing WhatsApp chat: ${inputFilePath}`);
  
  try {
    // Load the parsed messages
    const messages = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));
    
    // Analyze the chat
    const analysis = analyzeWhatsAppChat(messages);
    
    // Save to JSON
    saveAnalysis(analysis, outputFilePath);
    
    console.log('Analysis complete!');
    return analysis;
  } catch (error) {
    console.error('Error analyzing chat:', error);
    return null;
  }
}

// Example usage:
// processAnalysis('path/to/parsed_messages.json', 'path/to/analysis_results.json');

module.exports = {
  analyzeTemporalPatterns,
  analyzeContentPatterns,
  analyzeSentiment,
  analyzeRelationshipPatterns,
  analyzeWhatsAppChat,
  saveAnalysis,
  processAnalysis
};
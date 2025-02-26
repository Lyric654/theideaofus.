// WhatsApp Visualization Data Preparation
// This script transforms the analysis results into formats optimized for visualization

const fs = require('fs');

/**
 * Prepare timeline data for visualization
 * @param {Object} analysis - Analysis results
 * @returns {Object} - Timeline visualization data
 */
function prepareTimelineData(analysis) {
  const { messagesByMonth } = analysis.temporalAnalysis;
  const { topicsByMonth } = analysis.contentAnalysis;
  const { avgSentimentByMonth } = analysis.sentimentAnalysis;
  
  // Convert to array format for visualization
  const timelineData = Object.keys(messagesByMonth).sort().map(month => {
    return {
      month,
      messageCount: messagesByMonth[month],
      sentiment: avgSentimentByMonth[month] || 0,
      topics: topicsByMonth[month] || []
    };
  });
  
  return timelineData;
}

/**
 * Prepare relationship evolution data
 * @param {Object} analysis - Analysis results
 * @returns {Object} - Relationship evolution visualization data
 */
function prepareRelationshipEvolutionData(analysis) {
  const { windowMetrics, patternShifts } = analysis.relationshipAnalysis;
  
  // Prepare data for visualization
  const evolutionData = windowMetrics.map(window => {
    // Calculate balance of conversation (who's talking more)
    const senders = Object.keys(window.messagesBySender);
    let balanceRatio = 0.5; // Default to balanced
    
    if (senders.length === 2) {
      const [sender1, sender2] = senders;
      const total = window.messagesBySender[sender1] + window.messagesBySender[sender2];
      balanceRatio = window.messagesBySender[sender1] / total;
    }
    
    return {
      startDate: window.startDate,
      endDate: window.endDate,
      messageCount: window.messageCount,
      messagesPerDay: window.messagesPerDay,
      responseFrequency: window.responseFrequency,
      balanceRatio,
      senders: window.messagesBySender
    };
  });
  
  // Mark significant shifts
  const shifts = patternShifts.map(shift => ({
    date: shift.date,
    frequencyChange: shift.metrics.frequencyChange,
    responseChange: shift.metrics.responseChange
  }));
  
  return {
    evolution: evolutionData,
    shifts
  };
}

/**
 * Prepare conversation topic data for visualization
 * @param {Object} analysis - Analysis results
 * @returns {Object} - Topic visualization data
 */
function prepareTopicData(analysis) {
  const { topicsByMonth } = analysis.contentAnalysis;
  const { messagesByMonth } = analysis.temporalAnalysis;
  
  // Get all unique terms
  const allTerms = new Set();
  Object.values(topicsByMonth).forEach(topics => {
    topics.forEach(topic => allTerms.add(topic.term));
  });
  
  // Track term importance over time
  const termEvolution = {};
  allTerms.forEach(term => {
    termEvolution[term] = [];
  });
  
  // Sort months chronologically
  const months = Object.keys(topicsByMonth).sort();
  
  // Build evolution data
  months.forEach(month => {
    const topics = topicsByMonth[month] || [];
    const topicMap = {};
    topics.forEach(topic => {
      topicMap[topic.term] = topic.tfidf;
    });
    
    // Add data point for each term
    allTerms.forEach(term => {
      termEvolution[term].push({
        month,
        importance: topicMap[term] || 0
      });
    });
  });
  
  // Filter to most significant terms
  const significantTerms = [...allTerms].filter(term => {
    // Sum importance across all months
    const totalImportance = termEvolution[term].reduce((sum, point) => sum + point.importance, 0);
    return totalImportance > 0.5; // Arbitrary threshold
  });
  
  // Create stream graph data
  const streamData = months.map(month => {
    const dataPoint = { month };
    significantTerms.forEach(term => {
      const monthData = termEvolution[term].find(point => point.month === month);
      dataPoint[term] = monthData ? monthData.importance : 0;
    });
    return dataPoint;
  });
  
  return {
    streamData,
    significantTerms
  };
}

/**
 * Prepare language pattern data for visualization
 * @param {Object} analysis - Analysis results
 * @returns {Object} - Language patterns visualization data
 */
function prepareLanguagePatterns(analysis) {
  const { wordsBySender, emojisBySender } = analysis.contentAnalysis;
  
  // Extract top words by sender
  const topWordsBySender = {};
  for (const [sender, words] of Object.entries(wordsBySender)) {
    // Sort words by frequency
    const sortedWords = Object.entries(words)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20) // Take top 20
      .map(([word, count]) => ({ word, count }));
    
    topWordsBySender[sender] = sortedWords;
  }
  
  // Extract top emojis by sender
  const topEmojisBySender = {};
  for (const [sender, emojis] of Object.entries(emojisBySender)) {
    // Sort emojis by frequency
    const sortedEmojis = Object.entries(emojis)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10) // Take top 10
      .map(([emoji, count]) => ({ emoji, count }));
    
    topEmojisBySender[sender] = sortedEmojis;
  }
  
  return {
    topWordsBySender,
    topEmojisBySender
  };
}

/**
 * Prepare sentiment journey data for visualization
 * @param {Object} analysis - Analysis results
 * @returns {Object} - Sentiment journey visualization data
 */
function prepareSentimentJourney(analysis) {
  const { sentimentTimeline } = analysis.sentimentAnalysis;
  
  // Group by week for smoother visualization
  const sentimentByWeek = {};
  
  sentimentTimeline.forEach(point => {
    const date = new Date(point.timestamp);
    // Get week number (approximate by dividing month days by 7)
    const weekNum = Math.floor(date.getDate() / 7);
    const weekKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-w${weekNum}`;
    
    sentimentByWeek[weekKey] = sentimentByWeek[weekKey] || [];
    sentimentByWeek[weekKey].push(point.score);
  });
  
  // Calculate average sentiment per week
  const weeklyData = Object.entries(sentimentByWeek).map(([week, scores]) => {
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Extract year and month from week key
    const [yearMonth, weekPart] = week.split('-w');
    
    return {
      week,
      yearMonth,
      weekNum: parseInt(weekPart),
      avgSentiment: avgScore
    };
  }).sort((a, b) => a.week.localeCompare(b.week));
  
  return weeklyData;
}

/**
 * Generate full visualization dataset
 * @param {Object} analysis - Complete analysis results
 * @returns {Object} - Data formatted for visualization
 */
function prepareVisualizationData(analysis) {
  return {
    basicStats: analysis.basicStats,
    timeline: prepareTimelineData(analysis),
    relationshipEvolution: prepareRelationshipEvolutionData(analysis),
    topicStreams: prepareTopicData(analysis),
    languagePatterns: prepareLanguagePatterns(analysis),
    sentimentJourney: prepareSentimentJourney(analysis)
  };
}

/**
 * Save visualization data to a JSON file
 * @param {Object} visData - Visualization data
 * @param {string} outputPath - Path to save the output JSON file
 */
function saveVisualizationData(visData, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(visData, null, 2));
  console.log(`Saved visualization data to ${outputPath}`);
}

/**
 * Main function to prepare visualization data
 * @param {string} analysisFilePath - Path to the analysis results JSON
 * @param {string} outputFilePath - Path to save the visualization data
 */
function processVisualizationData(analysisFilePath, outputFilePath) {
  console.log(`Preparing visualization data from: ${analysisFilePath}`);
  
  try {
    // Load the analysis results
    const analysis = JSON.parse(fs.readFileSync(analysisFilePath, 'utf8'));
    
    // Prepare visualization data
    const visData = prepareVisualizationData(analysis);
    
    // Save to JSON
    saveVisualizationData(visData, outputFilePath);
    
    console.log('Visualization data preparation complete!');
    return visData;
  } catch (error) {
    console.error('Error preparing visualization data:', error);
    return null;
  }
}

// Example usage:
// processVisualizationData('path/to/analysis_results.json', 'path/to/visualization_data.json');

module.exports = {
  prepareTimelineData,
  prepareRelationshipEvolutionData,
  prepareTopicData,
  prepareLanguagePatterns,
  prepareSentimentJourney,
  prepareVisualizationData,
  saveVisualizationData,
  processVisualizationData
};
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const vw = screenWidth / 100;

interface ScoreBoxProps {
  score: number;
  backgroundColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  borderColor?: string;
}

export default function ScoreBox({ 
  score, 
  backgroundColor = '#000000',
  textColor = '#ffffff',
  width = vw * 15,
  height = vw * 12,
  fontSize = vw * 8,
  borderColor = '#ffffff'
}: ScoreBoxProps) {
  return (
    <View style={[
      styles.container,
      { 
        width, 
        height,
        backgroundColor,
        borderColor,
      }
    ]}>
      <Text style={[styles.scoreText, { fontSize, color: textColor }]}>
        {score.toString().padStart(2, '0')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
  },
  scoreText: {
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
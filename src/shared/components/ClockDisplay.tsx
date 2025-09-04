import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const vw = screenWidth / 100;

interface ClockDisplayProps {
  time: string;
  backgroundColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  borderColor?: string;
  showBorder?: boolean;
}

export default function ClockDisplay({ 
  time, 
  backgroundColor = '#000000',
  textColor = '#ff0000',
  width = vw * 25,
  height = vw * 10,
  fontSize = vw * 6,
  borderColor = '#ffffff',
  showBorder = true
}: ClockDisplayProps) {
  return (
    <View style={[
      styles.container,
      { 
        width, 
        height,
        backgroundColor,
        borderColor,
        borderWidth: showBorder ? 3 : 0,
      }
    ]}>
      <Text style={[styles.clockText, { fontSize, color: textColor }]}>
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  clockText: {
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
});
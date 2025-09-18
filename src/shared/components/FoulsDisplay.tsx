import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
const vw = screenWidth / 100;

interface FoulsDisplayProps {
  fouls: number;
  label?: string;
  backgroundColor?: string;
  textColor?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  position?: 'left' | 'right';
}

export default function FoulsDisplay({ 
  fouls,
  label = 'FOULS',
  backgroundColor = '#000000',
  textColor = '#ffff00',
  width = vw * 12,
  height = vw * 8,
  fontSize = vw * 4,
  position = 'left'
}: FoulsDisplayProps) {
  return (
    <View style={[
      styles.container,
      { 
        width, 
        height,
        backgroundColor,
      }
    ]}>
      <Text style={[styles.label, { fontSize: fontSize * 0.5, color: textColor }]}>
        {label}
      </Text>
      <Text style={[styles.foulText, { fontSize, color: textColor }]}>
        {fouls}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  label: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Roboto',
  },
  foulText: {
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
});
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' | null {
  const colorScheme = useRNColorScheme();
  return colorScheme === 'dark' ? 'dark' : colorScheme === 'light' ? 'light' : null;
}

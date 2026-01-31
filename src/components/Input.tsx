import React from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  onIconPress?: () => void;
  onIconRightPress?: () => void;
  isDarkMode?: boolean;
  containerStyle?: any;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  icon,
  iconRight,
  onIconPress,
  onIconRightPress,
  isDarkMode = false,
  containerStyle,
  onFocus,
  onBlur,
  secureTextEntry,
  ...textInputProps
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = React.useState(false);
  const neutralColors = isDarkMode ? colors.dark : colors.light;
  
  const focusAnim = React.useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    Animated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    Animated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      error ? colors.danger[500] : neutralColors.border,
      error ? colors.danger[500] : colors.primary[500],
    ],
  });

  const isPassword = secureTextEntry;
  const showPasswordToggle = isPassword;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { color: neutralColors.textSecondary },
          ]}
        >
          {label}
        </Text>
      )}
      <Animated.View
        style={[
          styles.inputContainer,
          {
            borderColor,
            backgroundColor: neutralColors.surface,
          },
          isFocused && styles.inputContainerFocused,
        ]}
      >
        {icon && (
          <TouchableOpacity
            onPress={onIconPress}
            disabled={!onIconPress}
            style={styles.iconLeft}
          >
            <Ionicons
              name={icon}
              size={20}
              color={isFocused ? colors.primary[500] : neutralColors.textTertiary}
            />
          </TouchableOpacity>
        )}
        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            {
              color: neutralColors.text,
              paddingLeft: icon ? spacing[10] : spacing[4],
              paddingRight: (iconRight || showPasswordToggle) ? spacing[10] : spacing[4],
            },
            textInputProps.style,
          ]}
          placeholderTextColor={neutralColors.textTertiary}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={isPassword && !isPasswordVisible}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off' : 'eye'}
              size={20}
              color={neutralColors.textTertiary}
            />
          </TouchableOpacity>
        )}
        {iconRight && !showPasswordToggle && (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={onIconRightPress}
            disabled={!onIconRightPress}
          >
            <Ionicons
              name={iconRight}
              size={20}
              color={isFocused ? colors.primary[500] : neutralColors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
      {(error || helper) && (
        <Text
          style={[
            styles.helper,
            { color: error ? colors.danger[500] : neutralColors.textSecondary },
          ]}
        >
          {error || helper}
        </Text>
      )}
    </View>
  );
};

// Search Input Component
interface SearchInputProps extends Omit<InputProps, 'icon'> {
  onSearch?: (text: string) => void;
  loading?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  loading = false,
  ...inputProps
}) => {
  return (
    <Input
      {...inputProps}
      icon="search"
      iconRight={loading ? undefined : 'close-circle'}
      placeholder="Search..."
      returnKeyType="search"
      onSubmitEditing={() => onSearch?.(inputProps.value || '')}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing[4],
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: '500',
    marginBottom: spacing[2],
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    height: 56,
  },
  inputContainerFocused: {
    ...shadows.sm,
  },
  iconLeft: {
    position: 'absolute',
    left: spacing[4],
    zIndex: 1,
  },
  iconRight: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: '400',
    height: '100%',
  },
  helper: {
    fontSize: typography.sizes.sm,
    marginTop: spacing[1],
    marginLeft: spacing[2],
  },
});

export default Input;

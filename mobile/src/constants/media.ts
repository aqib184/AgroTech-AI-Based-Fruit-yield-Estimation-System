import type { ImageSourcePropType } from 'react-native';

/**
 * Stable hero source for web/native. Keep a local fallback to avoid remote hotlink failures.
 */
export const PLACEHOLDER_ORCHARD_HERO: ImageSourcePropType = {
  uri: 'https://images.pexels.com/photos/2252584/pexels-photo-2252584.jpeg?auto=compress&cs=tinysrgb&w=1400',
};

export const LOGIN_HERO_IMAGE: ImageSourcePropType = require('../../imgs/1.jpg');
export const SIGNUP_HERO_IMAGE: ImageSourcePropType = require('../../imgs/2.jpg');
export const HOME_HEADER_IMAGE: ImageSourcePropType = require('../../imgs/3.jpg');
export const QUICK_GLANCE_WEATHER_IMAGE: ImageSourcePropType = require('../../imgs/8.jpg');
export const QUICK_GLANCE_CANOPY_IMAGE: ImageSourcePropType = require('../../imgs/5.jpg');
export const QUICK_GLANCE_ADVISORY_IMAGE: ImageSourcePropType = require('../../imgs/6.jpg');
export const HOME_ESTIMATION_CARD_IMAGE: ImageSourcePropType = require('../../imgs/9.jpg');

import { Platform } from 'react-native';
import LiveRideMapNative from './live-ride-map.native';
import LiveRideMapWeb from './live-ride-map.web';

const LiveRideMap = Platform.select({
    ios: LiveRideMapNative,
    android: LiveRideMapNative,
    default: LiveRideMapWeb,
});

export default LiveRideMap;

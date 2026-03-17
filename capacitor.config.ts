import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pharmaconnect.pharmacy',
  appName: 'PharmaConnect Pharmacie',
  webDir: 'dist',
  server: {
    url: 'https://shop.pharmaconnect-dj.com',
    cleartext: true,
  }
};

export default config;
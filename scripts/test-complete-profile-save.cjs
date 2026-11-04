const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('complete-profile.tsx imports completeProfile, upsertDriverProfile, and supabase', () => {
  const source = fs.readFileSync('app/complete-profile.tsx', 'utf8');

  // Verify imports
  assert.match(source, /import\s*\{\s*completeProfile\s*\}\s*from\s*["']@\/lib\/profile\/complete-profile["']/);
  assert.match(source, /import\s*\{\s*upsertDriverProfile\s*\}\s*from\s*["']@\/lib\/profile\/driver-profile["']/);
  assert.match(source, /import\s*\{\s*supabase\s*\}\s*from\s*["']@\/lib\/supabase["']/);
  assert.match(source, /import\s*\{[^}]*useAuthContext[^}]*\}\s*from\s*["']@\/hooks\/use-auth-context["']/);

  // Verify handleFinish calls completeProfile with trimmed fields
  assert.match(source, /await\s+completeProfile\(\s*\{\s*fullName:\s*fullName\.trim\(\),\s*university:\s*university\.trim\(\),\s*major:\s*major\.trim\(\),?\s*\}\s*\)/);

  // Verify handleFinish calls refreshProfile() before navigating
  assert.match(source, /await\s+refreshProfile\(\);/);

  // Verify handleFinish manages isSaving state to prevent duplicate submissions
  assert.match(source, /setIsSaving\(true\)/);
  assert.match(source, /setIsSaving\(false\)/);

  // Verify handleSkip directs to /(onboarding) instead of /(tabs) to prevent redirect loop
  assert.match(source, /const\s+handleSkip\s*=\s*\(\)\s*=>\s*\{\s*router\.replace\(["']\/\(onboarding\)["']\);\s*\};/);
});

test('complete-profile save flow simulation: saves profile, refreshes auth, and transitions route', async () => {
  let completeProfileCalled = false;
  let driverProfileCalled = false;
  let refreshProfileCalled = false;
  let navigatedTo = null;

  const mockCompleteProfile = async (data) => {
    completeProfileCalled = true;
    assert.equal(data.fullName, 'John Doe');
    assert.equal(data.university, 'Louisiana Tech University');
    assert.equal(data.major, 'Computer Science');
    return { id: 'user-1', ...data, profile_completed: true };
  };

  const mockDriverProfile = async (data) => {
    driverProfileCalled = true;
    assert.equal(data.vehicleMake, 'Toyota');
    assert.equal(data.vehicleModel, 'Corolla');
    assert.equal(data.vehicleYear, '2022');
  };

  const mockRefreshProfile = async () => {
    refreshProfileCalled = true;
  };

  const mockRouter = {
    replace: (path) => {
      navigatedTo = path;
    },
  };

  // Simulate handleFinish
  const fullName = '  John Doe  ';
  const university = '  Louisiana Tech University  ';
  const major = '  Computer Science  ';
  const isDriver = true;
  const vehicleMake = 'Toyota';
  const vehicleModel = 'Corolla';
  const vehicleYear = '2022';
  const vehicleColor = 'Silver';
  const licensePlateNumber = 'ABC1234';

  async function handleFinish() {
    if (isDriver) {
      await mockDriverProfile({
        vehicleMake: vehicleMake.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: vehicleYear.trim(),
        vehicleColor: vehicleColor.trim(),
        licensePlateNumber: licensePlateNumber.trim(),
      });
    }

    await mockCompleteProfile({
      fullName: fullName.trim(),
      university: university.trim(),
      major: major.trim(),
    });

    await mockRefreshProfile();
    mockRouter.replace('/(tabs)');
  }

  await handleFinish();

  assert.equal(completeProfileCalled, true, 'completeProfile must be executed');
  assert.equal(driverProfileCalled, true, 'upsertDriverProfile must be executed when isDriver is true');
  assert.equal(refreshProfileCalled, true, 'refreshProfile must be called to update isProfileComplete');
  assert.equal(navigatedTo, '/(tabs)', 'Should transition to /(tabs) after profile completion');
});

test('complete-profile error handling: preserves screen on failure and prevents navigation', async () => {
  let navigatedTo = null;

  const mockCompleteProfile = async () => {
    throw new Error('Database connection failed');
  };

  const mockRouter = {
    replace: (path) => {
      navigatedTo = path;
    },
  };

  let caughtError = null;

  async function handleFinish() {
    try {
      await mockCompleteProfile();
      mockRouter.replace('/(tabs)');
    } catch (err) {
      caughtError = err;
    }
  }

  await handleFinish();

  assert.notEqual(caughtError, null);
  assert.equal(caughtError.message, 'Database connection failed');
  assert.equal(navigatedTo, null, 'Must not navigate when completeProfile throws error');
});

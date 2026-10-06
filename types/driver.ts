export type DriverVerificationStatus =
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'rejected';

export type DriverProfile = {
    profileId: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
    vehicleColor: string;
    licensePlateNumber: string;
    verificationStatus: DriverVerificationStatus;
    verificationSessionId: string | null;
    createdAt: string;
    updatedAt: string;
};

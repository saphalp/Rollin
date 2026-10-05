export type DriverVerificationStatus =
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'rejected';

export type DriverProfile = {
    profileId: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleColor: string;
    licensePlateNumber: string;
    verificationStatus: DriverVerificationStatus;
    createdAt: string;
    updatedAt: string;
};

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  isActive: boolean;
}

export interface WorkingHours {
  id: number;
  staffProfileId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface TimeOff {
  id: number;
  staffProfileId: number;
  startDate: string;
  endDate: string;
  reason: string | null;
  createdAt: string;
}

export interface StaffProfile {
  id: number;
  userId: number;
  user: StaffUser;
  specialties: string[] | null;
  bio: string | null;
  workingHours?: WorkingHours[];
}

export interface CreateStaffAccountPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  specialties?: string[];
  bio?: string;
}

export interface UpdateStaffProfilePayload {
  specialties?: string[];
  bio?: string;
}

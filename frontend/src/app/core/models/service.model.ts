export interface Service {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface CreateServicePayload {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
}

export type UpdateServicePayload = Partial<CreateServicePayload> & {
  isActive?: boolean;
};

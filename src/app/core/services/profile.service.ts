import { inject, Injectable } from '@angular/core';
import { ProfileRepository } from '@core/data-access/profile.repository';
import type { Profile } from '@core/models/database';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly repository = inject(ProfileRepository);

  findAll(): Promise<Profile[]> {
    return this.repository.findAll();
  }
}

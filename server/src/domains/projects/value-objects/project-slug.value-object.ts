export class ProjectSlug {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  private validate(slug: string): void {
    if (!slug) {
      throw new Error('Project slug is required');
    }

    if (typeof slug !== 'string') {
      throw new Error('Project slug must be a string');
    }

    // Slug should be lowercase, alphanumeric with hyphens, 3-50 characters
    const slugRegex = /^[a-z0-9-]{3,50}$/;
    if (!slugRegex.test(slug)) {
      throw new Error(
        'Project slug must be 3-50 characters long and contain only lowercase letters, numbers, and hyphens'
      );
    }

    if (slug.startsWith('-') || slug.endsWith('-')) {
      throw new Error('Project slug cannot start or end with a hyphen');
    }

    // Check for consecutive hyphens
    if (slug.includes('--')) {
      throw new Error('Project slug cannot contain consecutive hyphens');
    }

    // Reserved slugs
    const reservedSlugs = [
      'api', 'admin', 'www', 'mail', 'ftp', 'localhost', 'test', 'staging',
      'production', 'dev', 'development', 'app', 'application', 'system',
      'root', 'user', 'users', 'account', 'accounts', 'profile', 'profiles',
      'settings', 'config', 'configuration', 'dashboard', 'home', 'index'
    ];

    if (reservedSlugs.includes(slug.toLowerCase())) {
      throw new Error(`Project slug '${slug}' is reserved and cannot be used`);
    }
  }

  public static create(value: string): ProjectSlug {
    return new ProjectSlug(value);
  }

  public static isValid(value: string): boolean {
    try {
      new ProjectSlug(value);
      return true;
    } catch {
      return false;
    }
  }

  public equals(other: ProjectSlug): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  public toJSON(): string {
    return this._value;
  }
}
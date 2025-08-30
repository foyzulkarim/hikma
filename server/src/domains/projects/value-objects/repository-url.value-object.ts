export class RepositoryUrl {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value;
  }

  public get value(): string {
    return this._value;
  }

  private validate(url: string): void {
    if (!url) {
      throw new Error('Repository URL is required');
    }

    if (typeof url !== 'string') {
      throw new Error('Repository URL must be a string');
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid repository URL format');
    }

    // Check supported protocols
    const supportedProtocols = ['http:', 'https:', 'git:', 'ssh:'];
    if (!supportedProtocols.includes(parsedUrl.protocol)) {
      throw new Error(
        `Unsupported protocol '${parsedUrl.protocol}'. Supported protocols: ${supportedProtocols.join(', ')}`
      );
    }

    // Validate common Git hosting patterns
    const gitPatterns = [
      /^https?:\/\/(www\.)?(github|gitlab|bitbucket)\.(com|org)\/.+\/.+(\.git)?$/i,
      /^git@(github|gitlab|bitbucket)\.(com|org):.+\/.+(\.git)?$/i,
      /^ssh:\/\/git@(github|gitlab|bitbucket)\.(com|org)\/.+\/.+(\.git)?$/i,
      /^https?:\/\/[\w.-]+\/.+\/.+(\.git)?$/i, // Generic Git server
      /^git:\/\/[\w.-]+\/.+\/.+(\.git)?$/i // Git protocol
    ];

    const isValidGitUrl = gitPatterns.some(pattern => pattern.test(url));
    if (!isValidGitUrl) {
      throw new Error(
        'Repository URL must be a valid Git repository URL (GitHub, GitLab, Bitbucket, or other Git server)'
      );
    }

    // Check URL length
    if (url.length > 2048) {
      throw new Error('Repository URL is too long (maximum 2048 characters)');
    }
  }

  public static create(value: string): RepositoryUrl {
    return new RepositoryUrl(value);
  }

  public static isValid(value: string): boolean {
    try {
      new RepositoryUrl(value);
      return true;
    } catch {
      return false;
    }
  }

  public getHostname(): string {
    try {
      return new URL(this._value).hostname;
    } catch {
      // For SSH URLs like git@github.com:user/repo.git
      const sshMatch = this._value.match(/git@([\w.-]+):/i);
      return sshMatch ? sshMatch[1] : '';
    }
  }

  public getProvider(): string {
    const hostname = this.getHostname().toLowerCase();
    if (hostname.includes('github')) return 'GitHub';
    if (hostname.includes('gitlab')) return 'GitLab';
    if (hostname.includes('bitbucket')) return 'Bitbucket';
    return 'Other';
  }

  public isHttps(): boolean {
    return this._value.startsWith('https://');
  }

  public isSsh(): boolean {
    return this._value.startsWith('git@') || this._value.startsWith('ssh://');
  }

  public equals(other: RepositoryUrl): boolean {
    return this._value === other._value;
  }

  public toString(): string {
    return this._value;
  }

  public toJSON(): string {
    return this._value;
  }
}
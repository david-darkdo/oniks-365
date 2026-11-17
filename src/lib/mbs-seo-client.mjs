// ============================================================================
// MBS SEO DASHBOARD PRO — WORKSPACE CLIENT SDK
// Zero-dependency client for independent Antigravity workspaces (Node 20+)
// Supports multi-search-engine SEO: Google Search Console, Bing Webmaster Tools & IndexNow
// Operations Engine: Batch URL submissions, IndexNow notifications & automation
// ============================================================================

export const DEFAULT_MBS_SEO_BASE_URL =
  "https://iaxatpjlmjsdcipxiuvc.supabase.co/functions/v1/mbs-seo-api";

export class MbsSeoClient {
  /**
   * @param {object} options
   * @param {string} [options.apiKey] - Project-scoped MBS API credential (mbs_live_<project>_...)
   * @param {string} [options.adminSecret] - Central MBS Admin secret for administrative endpoints
   * @param {string} [options.baseUrl] - Central MBS SEO API base URL
   */
  constructor({ apiKey, adminSecret, baseUrl = DEFAULT_MBS_SEO_BASE_URL } = {}) {
    this.apiKey = apiKey ? apiKey.trim() : null;
    this.adminSecret = adminSecret ? adminSecret.trim() : null;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async _request(method, path, { query, body, customHeaders } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, String(v));
        }
      }
    }

    const headers = {
      Accept: "application/json",
      ...customHeaders,
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
      headers["X-MBS-API-Key"] = this.apiKey;
    }
    if (this.adminSecret) {
      headers["X-MBS-Admin-Secret"] = this.adminSecret;
    }

    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let retries = 3;
    let lastErr;
    while (retries > 0) {
      try {
        const res = await fetch(url.toString(), init);
        const data = await res.json().catch(() => ({}));
        return {
          status: res.status,
          ok: res.ok && Boolean(data?.ok),
          data,
        };
      } catch (err) {
        lastErr = err;
        retries--;
        if (retries > 0) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
    throw lastErr;
  }

  // --------------------------------------------------------------------------
  // CORE INTELLIGENCE METHODS (PHASE 1 & 2)
  // --------------------------------------------------------------------------

  /** E. Retrieve authenticated project registration and assigned property mappings */
  async getProjectInfo(query = {}) {
    return this._request("GET", "/v1/project", { query });
  }

  /**
   * A. Discover search engine properties assigned to this project
   * @param {object|string} [queryOrProvider] - Options object or provider string ('google' | 'bing' | 'all')
   */
  async getProperties(queryOrProvider = {}) {
    const query = typeof queryOrProvider === "string" ? { provider: queryOrProvider } : queryOrProvider;
    return this._request("GET", "/v1/properties", { query });
  }

  /**
   * B. Query search engine performance (clicks, impressions, CTR, position)
   * @param {object} params
   * @param {string} [params.provider="google"] - 'google' | 'bing'
   * @param {string} [params.property_identifier]
   * @param {string} [params.start_date]
   * @param {string} [params.end_date]
   * @param {string[]} [params.dimensions]
   */
  async querySearchAnalytics(params = {}) {
    return this._request("POST", "/v1/search-analytics", { body: params });
  }

  /**
   * C. Inspect a production URL in Google Search Console or Bing Webmaster Tools
   * @param {object} options
   * @param {string} options.inspectionUrl
   * @param {string} [options.propertyIdentifier]
   * @param {string} [options.languageCode="en-US"]
   * @param {string} [options.provider="google"] - 'google' | 'bing'
   */
  async inspectUrl({ inspectionUrl, propertyIdentifier, languageCode = "en-US", provider = "google" }) {
    return this._request("POST", "/v1/url-inspection", {
      body: {
        inspection_url: inspectionUrl,
        property_identifier: propertyIdentifier,
        language_code: languageCode,
        provider,
      },
    });
  }

  /**
   * D. Retrieve submitted sitemaps and status for this project's property
   * @param {object} [options]
   * @param {string} [options.propertyIdentifier]
   * @param {string} [options.provider="google"] - 'google' | 'bing'
   */
  async getSitemaps({ propertyIdentifier, provider = "google" } = {}) {
    const query = { provider };
    if (propertyIdentifier) query.property_identifier = propertyIdentifier;
    return this._request("GET", "/v1/sitemaps", { query });
  }

  /**
   * D2. Submit a sitemap to Google Search Console or Bing Webmaster Tools
   * @param {object} options
   * @param {string} options.sitemapUrl
   * @param {string} [options.propertyIdentifier]
   * @param {boolean} [options.force=false]
   * @param {string} [options.provider="google"] - 'google' | 'bing'
   */
  async submitSitemap({ sitemapUrl, propertyIdentifier, force = false, provider = "google" } = {}) {
    return this._request("POST", "/v1/sitemaps/submit", {
      body: {
        sitemap_url: sitemapUrl,
        property_identifier: propertyIdentifier,
        force,
        provider,
      },
    });
  }

  /**
   * D3. Retrieve crawl statistics and submission quota (Bing Webmaster Tools)
   * @param {object} [options]
   * @param {string} [options.propertyIdentifier]
   * @param {string} [options.provider="bing"]
   */
  async getCrawlStats({ propertyIdentifier, provider = "bing" } = {}) {
    const query = { provider };
    if (propertyIdentifier) query.property_identifier = propertyIdentifier;
    return this._request("GET", "/v1/crawl-stats", { query });
  }

  /**
   * D4. Submit a single URL to Bing Webmaster Tools for fast crawling & discovery
   * @param {object} options
   * @param {string} options.url - Absolute URL to submit
   * @param {string} [options.propertyIdentifier]
   * @param {string} [options.provider="bing"]
   */
  async submitUrl({ url, propertyIdentifier, provider = "bing" } = {}) {
    return this._request("POST", "/v1/urls/submit", {
      body: {
        url,
        property_identifier: propertyIdentifier,
        provider,
      },
    });
  }

  /** Rotate this project's API credential with optional grace period and controlled scopes */
  async rotateCredential({ credentialLabel, gracePeriodSeconds = 0, scopes } = {}) {
    return this._request("POST", "/v1/credentials/rotate", {
      body: {
        credential_label: credentialLabel,
        grace_period_seconds: gracePeriodSeconds,
        scopes,
      },
    });
  }

  // --------------------------------------------------------------------------
  // OPERATIONS & INDEXING ENGINE METHODS (PHASE 2 & 3)
  // --------------------------------------------------------------------------

  /**
   * Submit a batch of URLs (up to 500) to Bing Webmaster Tools and/or IndexNow
   * @param {object} options
   * @param {string[]} options.urls - Array of absolute URLs belonging to project domain
   * @param {string} [options.propertyIdentifier] - Property URL override if multiple exist
   * @param {"bing"|"indexnow"|"all"} [options.provider="bing"] - Target discovery engine
   * @param {"urgent"|"high"|"normal"|"low"} [options.priority="normal"] - Submission queue priority
   */
  async submitUrlBatch({ urls, propertyIdentifier, provider = "bing", priority = "normal" } = {}) {
    return this._request("POST", "/v1/urls/submit-batch", {
      body: {
        urls,
        property_identifier: propertyIdentifier,
        provider,
        priority,
      },
    });
  }

  /**
   * Retrieve active and historical URL submission queue jobs
   * @param {object} [query]
   * @param {string} [query.status] - 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
   * @param {string} [query.provider] - 'bing' | 'indexnow'
   * @param {number} [query.limit=50]
   * @param {number} [query.offset=0]
   */
  async getUrlJobs(query = {}) {
    return this._request("GET", "/v1/urls/jobs", { query });
  }

  /**
   * Retrieve URL submission audit logs
   * @param {object} [query]
   * @param {string} [query.job_id]
   * @param {string} [query.provider]
   * @param {number} [query.limit=50]
   * @param {number} [query.offset=0]
   */
  async getUrlLogs(query = {}) {
    return this._request("GET", "/v1/urls/logs", { query });
  }

  /**
   * Retry a failed URL submission job
   * @param {object} options
   * @param {string} options.jobId
   */
  async retryUrlJob({ jobId } = {}) {
    return this._request("POST", "/v1/urls/retry-job", {
      body: { job_id: jobId },
    });
  }

  /** Retrieve project IndexNow configuration and verification status */
  async getIndexingConfig() {
    return this._request("GET", "/v1/indexing/config");
  }

  /**
   * Verify project IndexNow key file hosted on website root
   * @param {object} [options]
   * @param {string} [options.customKeyUrl] - Optional explicit URL of key file
   */
  async verifyIndexNowKey({ customKeyUrl } = {}) {
    return this._request("POST", "/v1/indexing/verify-key", {
      body: { custom_key_url: customKeyUrl },
    });
  }

  /**
   * Dispatch an immediate IndexNow notification for single or batch URLs
   * @param {object} options
   * @param {string|string[]} options.urls - Single URL or array of URLs
   * @param {string} [options.endpoint] - Optional custom IndexNow gateway
   */
  async submitIndexNow({ urls, endpoint } = {}) {
    const urlList = Array.isArray(urls) ? urls : [urls];
    return this._request("POST", "/v1/indexing/submit", {
      body: { urls: urlList, endpoint },
    });
  }

  /**
   * Query historical IndexNow dispatch logs
   * @param {object} [query]
   * @param {number} [query.limit=50]
   * @param {number} [query.offset=0]
   */
  async getIndexingLogs(query = {}) {
    return this._request("GET", "/v1/indexing/logs", { query });
  }

  /**
   * Record a content change event (e.g. product published, price updated, deleted)
   * Automatically dispatches IndexNow when project automation is enabled
   * @param {object} options
   * @param {"product_published"|"product_updated"|"product_deleted"|"category_updated"|"page_updated"} options.eventType
   * @param {string} options.entityUrl
   * @param {object} [options.metadata]
   * @param {boolean} [options.autoDispatch=false]
   */
  async sendIndexingEvent({ eventType, entityUrl, metadata = {}, autoDispatch = false } = {}) {
    return this._request("POST", "/v1/indexing/events", {
      body: {
        event_type: eventType,
        entity_url: entityUrl,
        metadata,
        auto_dispatch: autoDispatch,
      },
    });
  }

  /** Retrieve project automation controls and scheduled job settings */
  async getAutomationSettings() {
    return this._request("GET", "/v1/automation/settings");
  }

  /**
   * Update project automation controls
   * @param {object} settings
   * @param {boolean} [settings.auto_sitemap_check]
   * @param {boolean} [settings.auto_indexnow_notify]
   * @param {boolean} [settings.auto_bing_submit]
   * @param {number} [settings.daily_submission_quota]
   * @param {string} [settings.cron_schedule]
   */
  async updateAutomationSettings(settings = {}) {
    return this._request("POST", "/v1/automation/settings", { body: settings });
  }

  /**
   * Query operations audit logs
   * @param {object} [query]
   * @param {string} [query.action]
   * @param {number} [query.limit=50]
   * @param {number} [query.offset=0]
   */
  async getAuditLogs(query = {}) {
    return this._request("GET", "/v1/audit/logs", { query });
  }

  // --------------------------------------------------------------------------
  // ADMINISTRATIVE METHODS (PROTECTED BY X-MBS-ADMIN-SECRET)
  // --------------------------------------------------------------------------

  /** Retrieve complete cross-project operational overview */
  async getAdminOverview({ adminSecret } = {}) {
    return this._request("GET", "/v1/admin/overview", {
      customHeaders: adminSecret ? { "X-MBS-Admin-Secret": adminSecret } : {},
    });
  }

  /** Retrieve all project API credentials across the platform */
  async getAdminCredentials({ adminSecret } = {}) {
    return this._request("GET", "/v1/admin/credentials", {
      customHeaders: adminSecret ? { "X-MBS-Admin-Secret": adminSecret } : {},
    });
  }

  /**
   * Update scopes for an existing credential
   * @param {object} options
   * @param {string} options.credentialId
   * @param {string[]} options.scopes
   * @param {string} [options.adminSecret]
   */
  async updateCredentialScopes({ credentialId, scopes, adminSecret } = {}) {
    return this._request("POST", "/v1/admin/credentials/update-scopes", {
      body: { credential_id: credentialId, scopes },
      customHeaders: adminSecret ? { "X-MBS-Admin-Secret": adminSecret } : {},
    });
  }

  /** Verify IndexNow key files for all active projects */
  async verifyAllIndexNowKeys({ adminSecret } = {}) {
    return this._request("POST", "/v1/admin/indexing/verify-all", {
      customHeaders: adminSecret ? { "X-MBS-Admin-Secret": adminSecret } : {},
    });
  }
}

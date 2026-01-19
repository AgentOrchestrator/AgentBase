# Dependency Audit Report

**Date:** 2026-01-19
**Project:** Agent Orchestrator (AgentBase)
**Total Dependencies:** 1,442 (304 prod, 1,094 dev, 193 optional)

---

## Executive Summary

### Security Vulnerabilities
- **26 total vulnerabilities** detected:
  - 22 HIGH severity
  - 2 MODERATE severity
  - 2 LOW severity
- **Critical packages affected:** tar, semantic-release, electron-builder, sqlite3, vite, ts-node

### Package Status
- ✅ All packages are at latest versions within their specified semver ranges
- ⚠️ However, many packages require major version bumps to fix security issues
- 💡 npm version 10.9.4 is installed; latest is 11.7.0

---

## 🔴 Critical Security Issues

### 1. **tar package (HIGH severity)**
**CVE:** GHSA-8qq5-rm4j-mr97
**Issue:** Arbitrary File Overwrite and Symlink Poisoning via Insufficient Path Sanitization
**Affected versions:** ≤7.5.2
**Impact:** Affects multiple packages including:
- `@electron/rebuild`
- `@electron/node-gyp`
- `sqlite3`
- `semantic-release` (via npm)
- `electron-builder` (via app-builder-lib)

**Recommendation:** This is a transitive dependency issue. Fix requires updating parent packages.

### 2. **semantic-release (HIGH severity)**
**Current version:** ^24.2.9
**Issue:** Vulnerable via @semantic-release/npm which depends on vulnerable npm package
**Fix available:** Upgrade to semantic-release@25.0.2

**Action:**
```bash
npm install semantic-release@^25.0.2 --save-dev
```

### 3. **sqlite3 (HIGH severity)**
**Current version:** ^5.1.7 (in desktop app)
**Issue:** Vulnerable via node-gyp and tar dependencies
**Fix available:** Downgrade to sqlite3@5.0.2 (requires major version change)

**Recommendation:** Consider alternatives:
- Use `better-sqlite3@^12.4.1` (already in daemon) - it's more performant and actively maintained
- The daemon already uses `better-sqlite3`, desktop should align with this choice

### 4. **@electron/rebuild (HIGH severity)**
**Current version:** ^3.7.1 (in desktop)
**Issue:** Vulnerable via tar and @electron/node-gyp
**Fix available:** Major version downgrade (not recommended)

**Recommendation:** Wait for upstream patch or consider alternative build approaches

### 5. **electron-builder (HIGH severity)**
**Current version:** ^26.4.0 (in desktop)
**Issue:** Vulnerable via app-builder-lib, dmg-builder, and tar dependencies
**Fix available:** Downgrade to 23.0.6 (not recommended)

**Recommendation:** Monitor for security patches or upgrade when electron-builder@27 is released

### 6. **vite (MODERATE severity)**
**Current version:** ^5.0.8 (in desktop)
**Issue:** Vulnerable via esbuild dependency
**Affected versions:** 0.11.0 - 6.1.6
**Fix available:** Upgrade to vite@^7.3.1 (major version bump)

**Action:**
```bash
cd apps/desktop && npm install vite@^7.3.1 --save-dev
```
**Note:** Review for breaking changes in Vite 6 and 7

### 7. **ts-node (LOW severity)**
**Current version:** ^10.9.2
**Issue:** Vulnerable via diff package (DoS in parsePatch/applyPatch)
**CVE:** GHSA-73rr-hh4g-fpgx

**Recommendation:** Low priority but should monitor for updates

---

## 📊 Dependency Analysis

### Version Inconsistencies

#### 1. **@types/node** (INCONSISTENT VERSIONS)
- Root: `^22.0.0`
- daemon: `^24.7.2`
- desktop: `^20.10.0`
- shared: `^22.0.0`

**Impact:** Type mismatches, potential build issues
**Recommendation:** Align all packages to `^24.0.0` (latest)

**Action:**
```json
// Root package.json - add to "overrides"
"overrides": {
  "@types/react": "^19",
  "@types/react-dom": "^19",
  "@types/node": "^24.0.0"
}
```

#### 2. **typescript** (INCONSISTENT VERSIONS)
- Root: `^5.9.3`
- daemon: `^5.9.3`
- desktop: `^5.3.3` ⚠️
- shared: `^5.9.3`

**Recommendation:** Update desktop to `^5.9.3`

**Action:**
```bash
cd apps/desktop && npm install typescript@^5.9.3 --save-dev
```

#### 3. **electron** (INCONSISTENT VERSIONS)
- daemon: `^38.3.0` (optional)
- desktop: `^39.0.0`

**Recommendation:** Align to electron@^39.0.0 for consistency

#### 4. **AI SDK packages** (MINOR VERSION DRIFT)
- daemon: `ai@^5.0.76`, `@ai-sdk/anthropic@^2.0.33`, `@ai-sdk/openai@^2.0.52`
- desktop: `ai@^5.0.86`, `@ai-sdk/anthropic@^2.0.40`, `@ai-sdk/openai@^2.0.59`

**Impact:** Minimal (patch/minor versions)
**Recommendation:** Not urgent, but consider aligning during next update cycle

#### 5. **vitest** (INCONSISTENT VERSIONS)
- desktop: `^4.0.17`
- shared: `^4.0.17`

**Status:** Consistent ✅

---

## 🎯 Duplicate Dependencies

Based on package.json analysis, the following packages appear multiple times:

### Direct Duplicates
1. **ts-node**: Used in both daemon and desktop
   - Likely needed for development in both, acceptable duplication

2. **@anthropic-ai/claude-agent-sdk**:
   - shared: `^0.2.7`
   - desktop: `^0.2.7`
   - Consider hoisting to shared package only if desktop doesn't need direct access

### Potential Optimizations
- Consider if desktop really needs all AI SDK packages (`@ai-sdk/*`) or if these can be accessed via daemon
- Both apps define their own `@types/*` packages - leverage npm workspaces hoisting

---

## 🔧 Package Bloat Analysis

### Large Dependencies (by ecosystem)

#### Electron Ecosystem (~500MB installed)
- `electron`: Required for desktop app
- `electron-builder`: Required for packaging
- Not removable, but essential for desktop app

#### AI SDKs
- `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/openai`
- `openai` package
- These are core to the product functionality ✅

#### Build Tools
- `vite`, `turbo`, `typescript`, `@biomejs/biome`
- All essential for development ✅

### Potentially Unnecessary Dependencies

#### 1. **@types/sqlite3** in desktop package
**Current:** Listed as dependency (should be devDependency)
**Action:** Move to devDependencies or remove if using better-sqlite3

#### 2. **uuid@^13.0.0** (daemon)
**Note:** uuid@13.0.0 is ESM-only and very new (released 2024)
**Recommendation:** Verify compatibility with your build setup. Consider uuid@^10 if issues arise.

#### 3. **keytar@^7.9.0** (desktop)
**Purpose:** Secure credential storage
**Note:** This is good for production ✅ but verify it's actually being used

#### 4. **marked@^17.0.1** (desktop)
**Purpose:** Markdown parser
**Note:** You already have `react-markdown@^9.0.1` - check if both are needed
**Recommendation:** If using react-markdown for display, `marked` may be redundant

#### 5. **@paper-design/shaders-react@^0.0.70** (desktop)
**Note:** Version 0.0.x suggests unstable/alpha package
**Recommendation:** Verify this is necessary and monitor for stability

---

## 🚀 Recommended Actions

### Immediate (High Priority)

1. **Update semantic-release** (fixes HIGH severity issues)
   ```bash
   npm install semantic-release@^25.0.2 --save-dev
   ```

2. **Replace sqlite3 with better-sqlite3 in desktop** (fixes HIGH severity issues + better performance)
   ```bash
   cd apps/desktop
   npm uninstall sqlite3 @types/sqlite3
   npm install better-sqlite3@^12.4.1 --save
   npm install @types/better-sqlite3@^7.6.13 --save-dev
   ```
   **Note:** Requires code changes to use better-sqlite3 API

3. **Upgrade Vite to v7** (fixes MODERATE severity issue)
   ```bash
   cd apps/desktop
   npm install vite@^7.3.1 --save-dev
   ```
   **Note:** Test thoroughly for breaking changes

4. **Align @types/node versions** (fixes type inconsistencies)
   ```bash
   # In root package.json, update overrides
   npm install @types/node@^24.0.0 --save-dev
   ```
   Then update all workspace packages to use @types/node@^24.0.0

### Short Term (Medium Priority)

5. **Align TypeScript versions**
   ```bash
   cd apps/desktop
   npm install typescript@^5.9.3 --save-dev
   ```

6. **Review and remove duplicate markdown parsers**
   - Audit usage of `marked` vs `react-markdown`
   - Remove unused package

7. **Move @types/sqlite3 to devDependencies** (or remove entirely after switching to better-sqlite3)

8. **Align electron versions**
   ```bash
   cd apps/daemon
   npm install electron@^39.0.0 --save-optional
   ```

### Long Term (Monitor)

9. **Monitor electron-builder and @electron/rebuild** for security patches
   - Subscribe to GitHub security advisories
   - Check quarterly for updates

10. **Update npm globally**
    ```bash
    npm install -g npm@11.7.0
    ```

11. **Regular dependency audits**
    - Run `npm audit` monthly
    - Run `npm outdated` quarterly
    - Consider using Dependabot or Renovate bot for automated PRs

12. **Consider dependency-cruiser** for ongoing bloat analysis
    ```bash
    npm install --save-dev dependency-cruiser
    npx depcruise --output-type dot apps/desktop/src | dot -T svg > dependency-graph.svg
    ```

---

## 📈 Dependency Health Score

| Category | Score | Notes |
|----------|-------|-------|
| Security | 🔴 4/10 | 26 vulnerabilities (22 HIGH) |
| Up-to-dateness | 🟢 9/10 | All packages at latest in semver range |
| Consistency | 🟡 6/10 | Version mismatches across workspaces |
| Bloat | 🟢 8/10 | Minimal unnecessary dependencies |
| **Overall** | **🟡 6.75/10** | Security is primary concern |

---

## 🎯 Priority Matrix

```
HIGH IMPACT, HIGH URGENCY (DO NOW):
├─ Replace sqlite3 with better-sqlite3
├─ Update semantic-release to v25
└─ Upgrade Vite to v7

HIGH IMPACT, LOW URGENCY (PLAN):
├─ Monitor electron-builder for patches
├─ Align @types/node versions
└─ Align TypeScript versions

LOW IMPACT, HIGH URGENCY (QUICK WINS):
├─ Update npm to v11
├─ Remove duplicate markdown parser
└─ Fix @types/sqlite3 dependency type

LOW IMPACT, LOW URGENCY (BACKLOG):
├─ Align AI SDK versions
└─ Review @paper-design/shaders-react stability
```

---

## 📝 Notes

1. **Monorepo structure is well-organized** with clear separation between apps and packages
2. **npm workspaces + Turborepo** is a good choice for this project structure
3. **Most dependencies are justified** and core to the product
4. **Security vulnerabilities are primarily transitive** - waiting for upstream fixes in some cases
5. **Better-sqlite3 migration** will require code changes but provides significant benefits:
   - Better performance (synchronous API)
   - No native compilation issues (pure JS fallback)
   - More active maintenance
   - Fixes security issues

---

## 🔗 Useful Resources

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Vite 6 migration guide](https://vite.dev/guide/migration)
- [Vite 7 migration guide](https://vite.dev/guide/migration)
- [better-sqlite3 documentation](https://github.com/WiseLibs/better-sqlite3)
- [semantic-release v25 changelog](https://github.com/semantic-release/semantic-release/releases/tag/v25.0.0)

---

**Report Generated by:** Claude Code
**Audit Method:** npm audit, package.json analysis, security advisory research

# Handling Protected Branch - Step by Step

## Recommended Approach: Replace Default Branch

### Step 1: Change Default Branch
1. Go to: https://github.com/michaelfperla/permisos-digitales/settings
2. Click "Branches" in the left sidebar
3. In "Default branch" section, click the switch icon
4. Select `production-clean-2025-07-26`
5. Click "Update"
6. Confirm the change

### Step 2: Delete Old Main (Now Safe)
```bash
# Since it's no longer the default, we can delete it
git push origin --delete main
```

### Step 3: Rename Our Branch to Main
```bash
# Rename the clean branch to main
git push origin production-clean-2025-07-26:main
git push origin --delete production-clean-2025-07-26
```

### Step 4: Update Local Repository
```bash
# Update your local to track the new main
git branch -m main
git fetch origin
git branch -u origin/main main
git remote set-head origin -a
```

## Alternative: If You Want to Keep Protection

### Via Pull Request:
1. Go to: https://github.com/michaelfperla/permisos-digitales/pull/new/production-clean-2025-07-26
2. Create pull request to merge into main
3. As repository owner, you can:
   - Approve your own PR
   - Use "Administrator override" to bypass requirements
   - Merge even if checks fail

### Temporarily Disable Protection:
1. Go to: https://github.com/michaelfperla/permisos-digitales/settings/branches
2. Click "Edit" next to main branch rule
3. Uncheck "Restrict who can push to matching branches"
4. Save changes
5. Force push: `git push origin main --force`
6. Re-enable protection

## Why Branch Protection Exists
- Prevents accidental force pushes
- Ensures code review process
- Protects production code
- Maintains CI/CD requirements
- Provides audit trail

## What Protection Settings to Keep
After cleanup, consider these protection rules for main:
- ✅ Require pull request reviews (optional for solo projects)
- ✅ Dismiss stale PR approvals when new commits are pushed
- ✅ Require status checks (tests must pass)
- ✅ Require branches to be up to date
- ✅ Include administrators (even you follow the rules)
- ❌ Allow force pushes (keep this OFF)
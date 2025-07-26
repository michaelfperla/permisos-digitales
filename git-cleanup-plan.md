# Git Repository Cleanup Plan

## Current Situation
- Local branch: `agents/guardian-workspace` (matches production)
- 536 total changes (225 modified, 137 deleted, 174 untracked)
- Multiple stale branches and complex history

## Recommended Approach: Clean Slate with Production Code

### Step 1: Final Backup
```bash
# Already completed - backup branch created
# Stash reference: d2b2880f236aa5e60c2c166411fff0821650d5ff
```

### Step 2: Create Clean Production Branch
```bash
# Create orphan branch (no parent history)
git checkout --orphan production-baseline-2025-07-26

# Add all current files
git add -A

# Create comprehensive commit
git commit -m "Production baseline: Complete application as deployed 2025-07-26

## Major Components
- WhatsApp bot integration with comprehensive security
- Stripe payment processing with OXXO support
- Enhanced admin panel with monitoring dashboard  
- Mobile-first responsive UI
- PDF generation with S3 storage
- Redis-based session management
- Bull queue for async processing

## Security Features
- CSRF protection with session middleware
- Log sanitization system
- Payment velocity checks
- Rate limiting and flood protection
- Input validation and sanitization

## Architecture
- Service container with dependency injection
- Repository pattern for data access
- Comprehensive error handling
- Production monitoring and alerting

This commit represents the exact production state on AWS (107.21.154.162)"
```

### Step 3: Update Remote Repository
```bash
# Set as new main branch
git branch -M main

# Force push (CAUTION: This rewrites history)
git push origin main --force

# Update default branch on GitHub
# Go to Settings > Branches > Change default branch to 'main'
```

### Step 4: Clean Up Old Branches
```bash
# Delete all old remote branches except main
git push origin --delete fix/redis-lockout-production
git push origin --delete fix/password-reset-service-alignment
git push origin --delete fix/backend-integration-tests
git push origin --delete master
git push origin --delete docs/readme-overhaul

# Clean up local branches
git branch -D agents/architect-workspace
git branch -D agents/guardian-workspace
git branch -D agents/pipeline-workspace
git branch -D agents/testmaster-workspace
git branch -D develop
# ... etc
```

### Step 5: Create Development Structure
```bash
# Create standard branches from main
git checkout main
git checkout -b develop
git push origin develop

# Create feature branch example
git checkout -b feature/whatsapp-enhancements
```

### Step 6: Update Documentation
```bash
# Update README with new branch strategy
# Document that main = production
# Set up branch protection rules on GitHub
```

## Post-Cleanup Verification
1. Verify deployed code matches new main branch
2. Test git clone in new directory
3. Ensure CI/CD pipelines work with new structure
4. Update team on new git workflow

## Rollback Plan
If issues arise:
```bash
# Restore from backup branch
git checkout backup/pre-cleanup-[timestamp]
git branch -M main
git push origin main --force
```
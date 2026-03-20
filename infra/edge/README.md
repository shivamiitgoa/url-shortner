# Edge Stack

Optional stack for custom domain and global HTTPS load balancing.

Current implementation keeps this stack as a toggle-ready placeholder while using temporary `run.app` hostnames.

When you have a domain, extend this stack with:
- Serverless NEGs for API, redirect, and web services
- Global HTTPS load balancer
- Managed certificate
- Cloud Armor policy
- Cloud DNS records

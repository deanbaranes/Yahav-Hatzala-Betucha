import os
from pywebpush import generate_vapid_keypair

keypair = generate_vapid_keypair()
private_key = keypair['private_key']
public_key = keypair['public_key']

env_file = ".env"
with open(env_file, "a") as f:
    f.write(f"\nVAPID_PRIVATE_KEY={private_key}\n")
    f.write(f"VAPID_PUBLIC_KEY={public_key}\n")
    f.write(f"VAPID_CLAIMS_EMAIL=mailto:admin@example.com\n")

print(f"VAPID keys generated and appended to {env_file}")

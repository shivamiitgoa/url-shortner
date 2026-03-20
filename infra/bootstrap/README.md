# Bootstrap Stack

Creates an isolated GCP project and enables core services.

## Inputs

- `billing_account_id` (required): e.g. `billingAccounts/01E441-CCA873-1B3D53`
- `project_prefix` or explicit `project_id`
- `budget_amount_usd` default `200`

## Run

```bash
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap apply -var='billing_account_id=billingAccounts/01E441-CCA873-1B3D53'
```

## Outputs

- `project_id`
- `project_number`

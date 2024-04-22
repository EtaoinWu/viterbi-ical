export const isDenoDeploy = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
export const expire_time = isDenoDeploy ? 1000 * 60 * 30 : 1000 * 10; // 30 minutes

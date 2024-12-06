import { HardhatRuntimeEnvironment } from "hardhat/types";

export async function verifyContract(hre: HardhatRuntimeEnvironment, address: string, constructorArgs: any[] = []) {
  const network = hre.network.name;
  if (network !== "localhost" && network !== "hardhat") {
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs,
      });
      console.log("✅ Contract verified:", address);
    } catch (error) {
      if (!String(error).includes("Already Verified")) {
        console.log("⚠️ Verification failed:", error);
      } else {
        console.log("📝 Contract already verified:", address);
      }
    }
  }
}

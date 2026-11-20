"""BT.2408 SDR->HLG: SDR display light (BT.1886, gamma 2.4) placed at 203 cd/m2 reference white, BT.709->BT.2020
primaries, BT.2100 inverse OOTF for a 1000 cd/m2 HLG display (gamma 1.2), HLG OETF. Writes a 33^3 .cube LUT."""
import numpy as np
N = 33
v = np.linspace(0, 1, N)
M = np.array([[0.6274, 0.3293, 0.0433], [0.0691, 0.9195, 0.0114], [0.0164, 0.0880, 0.8956]])   # 709 -> 2020 (linear)
a, b, c = 0.17883277, 0.28466892, 0.55991073
def oetf(E):
    E = np.clip(E, 0, 1)
    return np.where(E <= 1 / 12, np.sqrt(3 * E), a * np.log(np.maximum(12 * E - b, 1e-12)) + c)
lines = [f"LUT_3D_SIZE {N}", "DOMAIN_MIN 0 0 0", "DOMAIN_MAX 1 1 1"]
for bb in v:
    for gg in v:
        for rr in v:
            rgb = np.array([rr, gg, bb]) ** 2.4 * 203.0          # display light, nits
            rgb = M @ rgb
            Yd = 0.2627 * rgb[0] + 0.6780 * rgb[1] + 0.0593 * rgb[2]
            if Yd <= 0:
                E = np.zeros(3)
            else:
                E = (Yd / 1000.0) ** ((1 - 1.2) / 1.2) * rgb / 1000.0
            o = oetf(E)
            lines.append(f"{o[0]:.6f} {o[1]:.6f} {o[2]:.6f}")
open("sdr2hlg.cube", "w").write("\n".join(lines) + "\n")
print("wrote sdr2hlg.cube")

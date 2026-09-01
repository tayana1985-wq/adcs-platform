# Максимальный достижимый Спирмен (по средним рангам) между двумя дискретными
# маргиналами при комонотонной сцепке (верхняя граница Фреше).
def midgrades(p):
    g, c = [], 0.0
    for pi in p:
        g.append(c + pi/2.0)
        c += pi
    return g

def comonotone(p, q):
    # совместное распределение верхней границы Фреше
    i = j = 0
    cp = list(p); cq = list(q)
    joint = []
    while i < len(cp) and j < len(cq):
        m = min(cp[i], cq[j])
        if m > 1e-15:
            joint.append((i, j, m))
        cp[i] -= m; cq[j] -= m
        if cp[i] <= 1e-15: i += 1
        if j < len(cq) and cq[j] <= 1e-15: j += 1
    return joint

def max_spearman(p, q):
    gp, gq = midgrades(p), midgrades(q)
    J = comonotone(p, q)
    mx = sum(pi*gp[i] for i, pi in enumerate(p))
    my = sum(qi*gq[j] for j, qi in enumerate(q))
    vx = sum(pi*(gp[i]-mx)**2 for i, pi in enumerate(p))
    vy = sum(qi*(gq[j]-my)**2 for j, qi in enumerate(q))
    cov = sum(w*(gp[i]-mx)*(gq[j]-my) for i, j, w in J)
    return cov/((vx**0.5)*(vy**0.5))

belonging = [0.0060, 0.0483, 0.3742, 0.2918, 0.2797]
uniform5  = [0.2]*5
scen = {
 "EQUAL_THIRDS":    [0.333,0.334,0.333],
 "CEILING_SKEW":    [0.100,0.200,0.700],
 "FLOOR_SKEW":      [0.700,0.200,0.100],
 "NEAR_DEGENERATE": [0.050,0.100,0.850],
 "ALMOST_CONSTANT": [0.005,0.005,0.990],
 "POLYGON_ACCESS":  [0.0336,0.6415,0.3249],
 "POLYGON_COMMUN":  [0.0302,0.6226,0.3472],
}
print("сценарий           потолок vs непрерывной   потолок vs belonging(5 знач.)  материальность 0.1724")
for k, p in scen.items():
    a = max_spearman(p, uniform5+[0]*0) if False else None
    # непрерывная сторона = предел равномерной с большим числом градаций
    cont = max_spearman(p, [1.0/400]*400)
    disc = max_spearman(p, belonging)
    print(f"{k:18s} {cont:8.4f}                {disc:8.4f}                     "
          f"{'достижима' if disc>0.1724 else 'НЕ ДОСТИЖИМА'}")

print()
print("сценарий           потолок(belonging)  0.1724/потолок   N из tap-2 (семья 1)")
tap2 = {"EQUAL_THIRDS":221,"CEILING_SKEW":221,"FLOOR_SKEW":221,
        "NEAR_DEGENERATE":221,"ALMOST_CONSTANT":185,"POLYGON_ACCESS":221,"POLYGON_COMMUN":221}
for k, p in scen.items():
    d = max_spearman(p, belonging)
    print(f"{k:18s} {d:8.4f}            {0.1724/d:8.3f}        {tap2[k]:6d}")

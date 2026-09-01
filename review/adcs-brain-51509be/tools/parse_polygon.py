import io, collections
F='/root/.claude/uploads/c647f978-452b-59ec-b0bc-eaabf574f96d/da724e07-ADCS_BRAIN_TEST_POLYGON_51509be.sql'
src=io.open(F,encoding='utf-8',errors='replace').read()
def rows(table):
    pat="INSERT INTO `%s` VALUES"%table; out=[]; i=0
    while True:
        j=src.find(pat,i)
        if j<0: return out
        k=j+len(pat); q=False
        while k<len(src):
            c=src[k]
            if q:
                if c=='\\': k+=2; continue
                if c=="'": q=False
                k+=1; continue
            if c=="'": q=True; k+=1; continue
            if c==';': break
            k+=1
        buf=src[j+len(pat):k]; i=k
        a=0; n=len(buf)
        while a<n:
            if buf[a]!='(': a+=1; continue
            a+=1; f=[]; cur=''; q=False
            while a<n:
                c=buf[a]
                if q:
                    if c=='\\': cur+=buf[a+1]; a+=2; continue
                    if c=="'": q=False; a+=1; continue
                    cur+=c; a+=1; continue
                if c=="'": q=True; a+=1; continue
                if c==',': f.append(cur); cur=''; a+=1; continue
                if c==')': f.append(cur); a+=1; break
                cur+=c; a+=1
            out.append(f)

import java.util.*;

class Solution {
	public int[] solution(String[] gems) {
        HashMap<String, Integer> names = new HashMap<>();
        
        for (String g: gems) {
            names.put(g, 0);
        }
        
        int count = names.size();
        
        int l = 0;
        int r = l;
        names = new HashMap<String, Integer>();
        TreeMap<Integer, ArrayList<Integer[]>> anlLst = new TreeMap<>();

        while (r < gems.length) {
            names.put(gems[r], names.getOrDefault(gems[r], 0) + 1);
            // 넣었는데 보석 전부 커버?
            if (names.size() == count) {
                // l을 오른쪽으로 이동해나가면서 구간에서 하나씩 제거해나간다.
                while (l < r) {
                    //d target gems[l]
                    if (names.get(gems[l]) == 1) {
                        break;
                    } else {
                        names.put(gems[l], names.get(gems[l]) - 1);
                        l++;
                    }

                }
                // reset;
                anlLst.putIfAbsent(r-l, new ArrayList<>());
                Integer[] a = new Integer[2];
                a[0] = l;
                a[1] = r;
                anlLst.get(r-l).add(a);
                names.clear();
                l++;
				r = l;
                continue;
            } else {
                r++;
            }
        }
        
        ArrayList<Integer[]> ls = anlLst.pollFirstEntry().getValue();
        Collections.sort(ls, new Comparator<Integer[]>() {
            @Override
            public int compare(Integer[] a, Integer[] b) {
                return a[0] - b[0];
            }
        });
        int[] answ = new int[2];
        answ[0] = ls.get(0)[0] + 1;
        answ[1] = ls.get(0)[1] + 1;
        return answ;
    }
}

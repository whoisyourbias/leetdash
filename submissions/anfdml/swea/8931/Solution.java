import java.util.ArrayList;
import java.util.Scanner;

class Solution
{
	public static void main(String args[]) throws Exception
	{
		
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
		
		for(int test_case = 1; test_case <= T; test_case++)
		{
			int K = sc.nextInt();
			ArrayList<Integer> arr = new ArrayList<>();
			for (int i = 0; i < K; i++) {
				int a = sc.nextInt();
				if(a!=0) {
					arr.add(a);
				}else {
					arr.remove(arr.size()-1);
				}
			}
			int sum = 0;
			for (int i = 0; i < arr.size(); i++) {
				sum += arr.get(i);
			}
			System.out.println("#"+test_case+" " + sum);
			
		}
	}
}

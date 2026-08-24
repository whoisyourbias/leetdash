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
			String str = sc.next();
			
			int count = 0; 
			for (int i = 0; i < str.length(); i++) {
				if(str.charAt(i)=='x') {
					count++;
				}
			}
			if(count>7) {
				System.out.println("#"+test_case+" "+"NO");
			}else {
				System.out.println("#"+test_case+" "+"YES");
			}
		}
	}
}